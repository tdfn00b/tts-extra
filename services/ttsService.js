import { state, setState } from '../state.js';
import { parseTextForTTS, applyRegexReplacements, sanitizeTextForApi } from './ttsParser.js';
import { generateUniqueId, generateCacheKey } from './utils.js';

const audioCache = new Map();

const logApiRequest = (body, type) => {
    setState(prevState => ({
        apiRequestLog: [{ body, type, timestamp: Date.now() }, ...prevState.apiRequestLog],
    }));
};

const getFinalTtsSettings = (chunk) => {
    const { delimiterRules, voiceProfiles, ttsParams, advancedTtsSettings, ttsEndpoint, voiceId } = state;
    const rule = delimiterRules.find(r => r.name === chunk.type) || delimiterRules[0];
    const profile = voiceProfiles.find(p => p.id === rule.profileId) || voiceProfiles[0];
    const overrides = profile?.overrides?.[chunk.type] || {};
    
    return {
        ...ttsParams,
        ...advancedTtsSettings,
        ttsEndpoint: ttsEndpoint,
        voiceId: profile?.voiceId ? profile.voiceId : voiceId,
        temperature: overrides.temperature ?? ttsParams.temperature,
        exaggeration: overrides.exaggeration ?? ttsParams.exaggeration,
        cfgWeight: overrides.cfgWeight ?? ttsParams.cfgWeight,
    };
};

const generateTTSAudio = async (text, settings, signal) => {
    if (!text) return Promise.reject(new Error('Skipping empty chunk.'));

    const requestBody = {
        text: text,
        voice_mode: settings.voiceMode,
        predefined_voice_id: settings.voiceId,
        output_format: 'wav',
        split_text: settings.splitText,
        chunk_size: settings.chunkSize,
        temperature: settings.temperature,
        exaggeration: settings.exaggeration,
        cfg_weight: settings.cfgWeight,
        seed: settings.seed,
        speed_factor: settings.speed,
        language: settings.language,
    };

    logApiRequest(requestBody, '[API CALL]');

    const response = await fetch(settings.ttsEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(requestBody),
        signal,
    });

    if (!response.ok) {
        throw new Error(`TTS API request failed with status ${response.status}`);
    }

    const blob = await response.blob();
    return {
        audioUrl: URL.createObjectURL(blob),
        requestBody
    };
};

export const prepareAudio = (textToProcess) => {
    const { stripContentTags, stripTagsOnly, delimiterRules, selectedChunkTypes, generationStrategy, regexRules } = state;

    const initialChunks = parseTextForTTS(textToProcess, stripContentTags, stripTagsOnly, delimiterRules)
        .filter(chunk => selectedChunkTypes.has(chunk.type));

    let generationJobs = [];
    if (generationStrategy === 'individual') {
        generationJobs = initialChunks;
    } else if (generationStrategy === 'paragraph') {
        const grouped = initialChunks.reduce((acc, chunk) => {
            (acc[chunk.paragraphId] = acc[chunk.paragraphId] || []).push(chunk);
            return acc;
        }, {});
        generationJobs = Object.values(grouped).map(pChunks => {
            if (!pChunks || pChunks.length === 0) return null;
            return { ...pChunks[0], id: `p-${pChunks[0].paragraphId}-${generateUniqueId()}`, text: pChunks.map(c => c.text).join(' ') };
        }).filter(Boolean);
    } else if (generationStrategy === 'smart-group' && initialChunks.length > 0) {
        generationJobs = initialChunks.reduce((acc, chunk) => {
            const chunkSettings = getFinalTtsSettings(chunk);
            const { ttsEndpoint, ...apiSettings } = chunkSettings;
            const chunkSettingsKey = JSON.stringify(apiSettings);
            const lastGroup = acc[acc.length - 1];
            if (lastGroup && lastGroup.settingsKey === chunkSettingsKey) {
                lastGroup.text += ' ' + chunk.text;
            } else {
                acc.push({ ...chunk, id: `sg-${acc.length}-${generateUniqueId()}`, text: chunk.text, settingsKey: chunkSettingsKey });
            }
            return acc;
        }, []);
    }

    const generationPromises = generationJobs.map(job => new Promise(async (resolve, reject) => {
        try {
            if (state.abortController.signal.aborted) return reject(new Error('Aborted'));
            
            const finalSettings = getFinalTtsSettings(job);
            const textAfterRegex = applyRegexReplacements(job.text, job.type, regexRules);
            const textForApi = sanitizeTextForApi(textAfterRegex);
            const cacheKey = generateCacheKey(textForApi, finalSettings);
            
            let audioUrl;
            if (audioCache.has(cacheKey)) {
                const cachedData = audioCache.get(cacheKey);
                audioUrl = cachedData.audioUrl;
                logApiRequest(cachedData.requestBody, '[CACHE HIT]');
            } else {
                const result = await generateTTSAudio(textForApi, finalSettings, state.abortController.signal);
                audioUrl = result.audioUrl;
                audioCache.set(cacheKey, { audioUrl, requestBody: result.requestBody });
            }

            if (state.abortController.signal.aborted) return reject(new Error('Aborted'));
            
            resolve({ jobId: job.id, audioUrl });

        } catch (error) {
            error.jobId = job.id; // Attach job ID to error for identification
            reject(error);
        }
    }));

    return { newPlaybackQueue: generationJobs, generationPromises };
};
