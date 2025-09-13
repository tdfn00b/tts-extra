import { state, setState, subscribe } from './state.js';
import * as renderer from './ui/renderer.js';
import { getDomElements } from './ui/renderer.js';
import { parseTextForTTS } from './services/ttsParser.js';
import { prepareAudio } from './services/ttsService.js';
import * as player from './lib/player.js';
import { generateUniqueId } from './services/utils.js';

// Scope state for SillyTavern extension
const extensionName = 'tts-extra';
const extensionFolderPath = `extensions/third-party/${extensionName}/`;
let dom = {};

// --- CORE HANDLERS ---
const handlePanic = () => {
    if (state.abortController) {
        state.abortController.abort();
    }
    player.stop();
    setState({
        appStatus: 'idle',
        chunks: [],
        playbackQueue: [],
        currentPlaybackIndex: -1,
        abortController: new AbortController(),
    });
    console.log('Advanced TTS: Panic Activated.');
};

const handleParse = () => {
    handlePanic();
    const parsedChunks = parseTextForTTS(state.inputText, state.stripContentTags, state.stripTagsOnly, state.delimiterRules);
    setState({ chunks: parsedChunks });
};

const handlePrepareAudio = async (textToProcess = state.inputText) => {
    handlePanic();
    setState({ appStatus: 'preparing' });

    const { newPlaybackQueue, generationPromises } = prepareAudio(textToProcess);
    
    if (newPlaybackQueue.length === 0) {
        setState({ appStatus: 'idle' });
        return;
    }

    setState({
        chunks: newPlaybackQueue.map(job => ({ ...job, status: 'loading' })),
        playbackQueue: newPlaybackQueue.map(job => ({ ...job, status: 'loading' })),
    });

    let isFirstChunkReady = false;
    generationPromises.forEach(promise => {
        promise.then(result => {
            const { jobId, audioUrl } = result;
            const updateItem = (item) => item.id === jobId ? { ...item, status: 'ready', audioUrl } : item;
            
            setState(prevState => ({
                chunks: prevState.chunks.map(updateItem),
                playbackQueue: prevState.playbackQueue.map(updateItem),
            }));

            if (!isFirstChunkReady) {
                isFirstChunkReady = true;
                if (state.isAutoplayEnabled) {
                    player.play();
                } else {
                    setState({ appStatus: 'ready' });
                }
            }
        }).catch(error => {
            if (error.name !== 'AbortError') {
                console.error('Failed to prepare audio chunk:', error);
                 const { jobId } = error;
                 if(jobId) {
                    const updateItem = (item) => item.id === jobId ? { ...item, status: 'error' } : item;
                    setState(prevState => ({
                        chunks: prevState.chunks.map(updateItem),
                        playbackQueue: prevState.playbackQueue.map(updateItem),
                    }));
                 }
            }
        });
    });
};

const handleCharacterSpoke = (event) => {
    if (event.detail?.message) {
        const newMessage = event.detail.message.replace(/^[^:]+:\s*/, '').trim();
        setState({ inputText: newMessage });
        handlePrepareAudio(newMessage);
    }
};

// --- PRESET HANDLERS ---
const handleSavePreset = () => {
    const name = dom.presetNameInput.value.trim();
    if (!name) return;
    const newPreset = {
        ttsEndpoint: state.ttsEndpoint, voiceId: state.voiceId,
        stripContentTags: state.stripContentTags, stripTagsOnly: state.stripTagsOnly,
        voiceProfiles: state.voiceProfiles, delimiterRules: state.delimiterRules,
        regexRules: state.regexRules, ttsParams: state.ttsParams,
        advancedTtsSettings: state.advancedTtsSettings,
    };
    const updatedPresets = { ...state.presets, [name]: newPreset };
    setState({ presets: updatedPresets });
    localStorage.setItem('ttsPresets', JSON.stringify(updatedPresets));
    dom.presetNameInput.value = '';
};

const handleLoadPreset = () => {
    const name = dom.presetSelect.value;
    if (!name || !state.presets[name]) return;
    const p = state.presets[name];
    setState({ ...p, selectedChunkTypes: new Set(p.delimiterRules.map(r => r.name)) });
};

const handleDeletePreset = () => {
    const name = dom.presetSelect.value;
    if (!name) return;
    const { [name]: _, ...remainingPresets } = state.presets;
    setState({ presets: remainingPresets });
    localStorage.setItem('ttsPresets', JSON.stringify(remainingPresets));
    dom.presetSelect.value = '';
};

// --- SETTINGS HANDLERS ---
const handleSettingsInput = (e) => {
    const { key, type, value } = e.target.dataset;
    let finalValue = e.target.value;
    if (type === 'number') finalValue = parseFloat(finalValue) || 0;
    if (type === 'int') finalValue = parseInt(finalValue, 10) || 0;
    if (type === 'bool') finalValue = e.target.checked;
    
    if (key.startsWith('ttsParams.')) {
        setState({ ttsParams: { ...state.ttsParams, [key.split('.')[1]]: finalValue }});
    } else if (key.startsWith('advancedTtsSettings.')) {
        setState({ advancedTtsSettings: { ...state.advancedTtsSettings, [key.split('.')[1]]: finalValue }});
    } else {
        setState({ [key]: finalValue });
    }
};

const handleSettingsAction = (e) => {
    const { action, type } = e.target.dataset;

    if (action === 'add-delimiter-rule') {
        const newRule = { id: generateUniqueId(), name: 'new-type', start: '{', end: '}', color: '#ffffff', profileId: state.voiceProfiles[0]?.id || '' };
        setState({ delimiterRules: [...state.delimiterRules, newRule] });
    }
    else if (action === 'remove-delimiter-rule') {
        const id = e.target.closest('.adv-tts-rule-row').dataset.id;
        setState({ delimiterRules: state.delimiterRules.filter(r => r.id !== id) });
    }
    else if (action === 'add-voice-profile') {
        const newProfile = { id: generateUniqueId(), name: 'New Profile', voiceId: '', overrides: {} };
        setState({ voiceProfiles: [...state.voiceProfiles, newProfile] });
    }
    else if (action === 'remove-voice-profile') {
        const idToRemove = e.target.closest('.adv-tts-profile-card').dataset.id;
        const fallbackId = state.voiceProfiles.find(p => p.id !== idToRemove)?.id;
        if (!fallbackId) return; // Don't remove the last one
        setState({
            voiceProfiles: state.voiceProfiles.filter(p => p.id !== idToRemove),
            delimiterRules: state.delimiterRules.map(r => r.profileId === idToRemove ? { ...r, profileId: fallbackId } : r)
        });
    }
    else if (action === 'add-regex-rule') {
        const newRule = { id: generateUniqueId(), enabled: true, pattern: '', replacement: '', flags: 'g', scope: 'global' };
        setState({ regexRules: [...state.regexRules, newRule] });
    }
    else if (action === 'remove-regex-rule') {
        const id = e.target.closest('.adv-tts-rule-row').dataset.id;
        setState({ regexRules: state.regexRules.filter(r => r.id !== id) });
    }
};

const handleSettingsChange = (e) => {
    const { id, field, type } = e.target.dataset;
    let value = e.target.value;
    if (e.target.type === 'checkbox') value = e.target.checked;
    
    if (type === 'delimiter-rule') {
        setState({ delimiterRules: state.delimiterRules.map(r => r.id === id ? { ...r, [field]: value } : r) });
    } 
    else if (type === 'regex-rule') {
        setState({ regexRules: state.regexRules.map(r => r.id === id ? { ...r, [field]: value } : r) });
    }
    else if (type === 'voice-profile') {
         setState({ voiceProfiles: state.voiceProfiles.map(p => p.id === id ? { ...p, [field]: value } : p) });
    }
    else if (type === 'voice-profile-override') {
        const profileId = e.target.closest('.adv-tts-profile-card').dataset.id;
        const typeName = e.target.dataset.typeName;
        const param = e.target.dataset.param;
        
        setState({ voiceProfiles: state.voiceProfiles.map(p => {
            if (p.id !== profileId) return p;
            const newOverrides = JSON.parse(JSON.stringify(p.overrides));
            if (!newOverrides[typeName]) newOverrides[typeName] = {};
            if (value === '' || isNaN(parseFloat(value))) {
                delete newOverrides[typeName][param];
                if (Object.keys(newOverrides[typeName]).length === 0) delete newOverrides[typeName];
            } else {
                newOverrides[typeName][param] = parseFloat(value);
            }
            return { ...p, overrides: newOverrides };
        })});
    }
};

// --- EVENT BINDING ---
const bindEventListeners = () => {
    dom.savePresetBtn.onclick = handleSavePreset;
    dom.presetSelect.onchange = handleLoadPreset;
    dom.deletePresetBtn.onclick = handleDeletePreset;
    dom.parseBtn.onclick = handleParse;
    dom.prepareBtn.onclick = () => handlePrepareAudio();
    dom.panicBtn.onclick = handlePanic;
    dom.playPauseBtn.onclick = player.togglePlayPause;
    dom.skipBtn.onclick = player.skip;
    dom.rewindBtn.onclick = player.rewind;
    dom.replayAllBtn.onclick = player.replayAll;
    dom.volumeSlider.oninput = (e) => player.setVolume(parseFloat(e.target.value));
    dom.autoplayToggle.onchange = (e) => setState({ isAutoplayEnabled: e.target.checked });
    dom.inputTextarea.oninput = (e) => setState({ inputText: e.target.value });
    dom.debugHeader.onclick = () => renderer.toggleDebug();
    dom.clearLogBtn.onclick = (e) => { e.stopPropagation(); setState({ apiRequestLog: [] }); };

    // Settings event delegation
    dom.settingsGeneral.oninput = handleSettingsInput;
    dom.settingsParams.oninput = handleSettingsInput;
    dom.settingsDelimiters.oninput = handleSettingsChange;
    dom.settingsDelimiters.onclick = handleSettingsAction;
    dom.settingsProfiles.oninput = handleSettingsChange;
    dom.settingsProfiles.onclick = handleSettingsAction;
    dom.settingsRegex.oninput = handleSettingsChange;
    dom.settingsRegex.onclick = handleSettingsAction;

    document.addEventListener('character-spoke', handleCharacterSpoke);
};

const removeEventListeners = () => {
    document.removeEventListener('character-spoke', handleCharacterSpoke);
};

// --- SILLYTAVERN EXTENSION MODULE ---
const sillyTavernExtensionModule = {
    onLoad: async () => {
        const cssPath = `./style.css`;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = cssPath;
        link.id = "adv-tts-style";
        document.head.appendChild(link);

        const htmlPath = `./index.html`;
        try {
            const response = await fetch(htmlPath);
            if (!response.ok) return console.error('Failed to load Advanced TTS HTML');

            const extensionsSettings = document.querySelector('#extensions_settings');
            if (extensionsSettings) {
                const container = document.createElement('div');
                container.innerHTML = await response.text();
                extensionsSettings.appendChild(container);

                dom = getDomElements();
                renderer.init(dom);
                player.init(dom);

                try {
                    const savedPresets = localStorage.getItem('ttsPresets');
                    if (savedPresets) setState({ presets: JSON.parse(savedPresets) });
                } catch (e) { console.error("Failed to load TTS presets:", e); }

                subscribe(renderer.render);
                renderer.render(state, state);
                bindEventListeners();
                console.log("Advanced TTS Control loaded successfully.");

            } else {
                console.error("Could not find extensions settings to attach Advanced TTS UI.");
            }
        } catch (error) {
            console.error('Error loading Advanced TTS extension:', error);
        }
    },
    onUnload: () => {
        const container = document.getElementById('adv-tts-app-container');
        if (container) container.parentElement.remove();
        
        const style = document.getElementById('adv-tts-style');
        if (style) style.remove();

        removeEventListeners();
        handlePanic();
        
        console.log("Advanced TTS Control unloaded.");
    },
};

self.SillyTavernExtensionModule = sillyTavernExtensionModule;
