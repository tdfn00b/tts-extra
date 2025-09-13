import { state } from '../state.js';

let dom = {};
let isDebugVisible = false;

export const init = (domElements) => {
    dom = domElements;
};

export const getDomElements = () => {
    const ids = [
        'app-container', 'loading-overlay', 'preset-name-input', 'save-preset-btn', 'preset-select',
        'delete-preset-btn', 'input-textarea', 'parse-btn', 'prepare-btn', 'panic-btn',
        'output-container', 'rewind-btn', 'play-pause-btn', 'skip-btn', 'replay-all-btn',
        'volume-slider', 'volume-value', 'autoplay-toggle', 'playlist-container',
        'debug-header', 'clear-log-btn', 'debug-content', 'settings-general', 
        'settings-params', 'settings-profiles', 'settings-delimiters', 'settings-regex'
    ];
    const elements = {};
    ids.forEach(id => {
        const camelCaseId = id.replace(/-(\w)/g, (_, c) => c.toUpperCase());
        elements[camelCaseId] = document.getElementById(`adv-tts-${id}`);
    });
    return elements;
};

const renderChunks = () => {
    if (!dom.outputContainer) return;
    if (state.chunks.length === 0) {
        dom.outputContainer.innerHTML = `<p class="adv-tts-placeholder">// Output will appear here...</p>`;
        return;
    }
    dom.outputContainer.innerHTML = state.chunks.map(chunk => `
        <div class="adv-tts-chunk-item" style="border-left-color: ${chunk.color || '#888'}">
            <span class="adv-tts-chunk-type" style="color: ${chunk.color}">${chunk.type.toUpperCase()}</span>
            <p>${chunk.text}</p>
        </div>`).join('');
};

const renderPlaylist = () => {
    if (!dom.playlistContainer) return;
    if (state.playbackQueue.length === 0) {
        dom.playlistContainer.innerHTML = `<p class="adv-tts-placeholder">// Queue is empty...</p>`;
        return;
    }
    dom.playlistContainer.innerHTML = state.playbackQueue.map((chunk, index) => {
        const isPlaying = index === state.currentPlaybackIndex;
        return `
         <div class="adv-tts-playlist-item ${isPlaying ? 'playing' : ''}" data-id="${chunk.id}" style="border-left-color: ${chunk.color}">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="adv-tts-playlist-type" style="color: ${chunk.color}">${chunk.type}</span>
                <span class="adv-tts-playlist-status ${chunk.status}">${chunk.status}</span>
            </div>
            <p>${chunk.text}</p>
        </div>`;
    }).join('');
};

const renderPlaybackControls = () => {
    if (!dom.playPauseBtn) return;
    const isPlaybackReady = ['ready', 'playing', 'paused'].includes(state.appStatus) && state.playbackQueue.length > 0;
    
    dom.playPauseBtn.innerHTML = state.appStatus === 'playing' ? '&#9208;' : '&#9654;';
    
    [dom.playPauseBtn, dom.rewindBtn, dom.skipBtn, dom.replayAllBtn].forEach(btn => {
        btn.disabled = !isPlaybackReady;
    });

    dom.volumeValue.textContent = `${Math.round(state.volume * 100)}%`;
    dom.volumeSlider.value = state.volume;
    dom.autoplayToggle.checked = state.isAutoplayEnabled;
};

const renderAppStatus = () => {
    if (!dom.loadingOverlay || !dom.prepareBtn || !dom.parseBtn) return;
    const isBusy = state.appStatus === 'preparing';
    dom.loadingOverlay.style.display = isBusy ? 'flex' : 'none';
    dom.prepareBtn.disabled = isBusy;
    dom.parseBtn.disabled = isBusy;
};

const renderDebugLog = () => {
    if(!dom.debugContent) return;
    dom.debugContent.style.display = isDebugVisible ? 'block' : 'none';
    if (state.apiRequestLog.length === 0) {
        dom.debugContent.innerHTML = `<p class="adv-tts-placeholder">No requests logged yet.</p>`;
        return;
    }
    dom.debugContent.innerHTML = state.apiRequestLog.map(entry => `
        <div>
            <span class="adv-tts-log-type ${entry.type === '[CACHE HIT]' ? 'cache-hit' : ''}">${entry.type}</span>
            <pre id="adv-tts-debug-log-entry"><code>${JSON.stringify(entry.body, null, 2)}</code></pre>
        </div>`).join('');
};

export const toggleDebug = () => {
    isDebugVisible = !isDebugVisible;
    renderDebugLog();
};

export const renderPresets = () => {
    const presetNames = Object.keys(state.presets).sort();
    const currentSelection = dom.presetSelect.value;
    if (presetNames.length === 0) {
        dom.presetSelect.innerHTML = `<option value="">No presets saved</option>`;
        dom.presetSelect.disabled = true;
    } else {
        dom.presetSelect.innerHTML = `<option value="">Load Preset...</option>` +
            presetNames.map(name => `<option value="${name}" ${name === currentSelection ? 'selected' : ''}>${name}</option>`).join('');
        dom.presetSelect.disabled = false;
    }
}

// --- Settings Renderers ---
const renderGeneralSettings = () => {
    dom.settingsGeneral.innerHTML = `
        <h2>General Settings</h2>
        <div class="adv-tts-input-group">
            <label for="adv-tts-setting-endpoint">TTS Endpoint URL</label>
            <input id="adv-tts-setting-endpoint" type="text" class="adv-tts-input" value="${state.ttsEndpoint}" data-key="ttsEndpoint">
        </div>
        <div class="adv-tts-input-group">
            <label for="adv-tts-setting-voice-id">Default Voice ID</label>
            <input id="adv-tts-setting-voice-id" type="text" class="adv-tts-input" value="${state.voiceId}" data-key="voiceId">
        </div>
        <div class="adv-tts-input-group">
            <label for="adv-tts-setting-strip-content">Strip Content Tags (comma-separated)</label>
            <input id="adv-tts-setting-strip-content" type="text" class="adv-tts-input" value="${state.stripContentTags}" data-key="stripContentTags">
        </div>
        <div class="adv-tts-input-group">
            <label for="adv-tts-setting-strip-tags">Strip Tags Only (comma-separated)</label>
            <input id="adv-tts-setting-strip-tags" type="text" class="adv-tts-input" value="${state.stripTagsOnly}" data-key="stripTagsOnly">
        </div>
    `;
};

const renderTtsParams = () => {
    dom.settingsParams.innerHTML = `
        <h2>TTS Parameters</h2>
        <div class="adv-tts-input-group">
            <label>Temperature</label>
            <div class="adv-tts-slider-group">
                <input type="range" class="adv-tts-slider" min="0" max="1" step="0.05" value="${state.ttsParams.temperature}" data-key="ttsParams.temperature" data-type="number">
                <span class="adv-tts-slider-value">${state.ttsParams.temperature.toFixed(2)}</span>
            </div>
        </div>
         <div class="adv-tts-input-group">
            <label>Exaggeration</label>
            <div class="adv-tts-slider-group">
                <input type="range" class="adv-tts-slider" min="0" max="2" step="0.05" value="${state.ttsParams.exaggeration}" data-key="ttsParams.exaggeration" data-type="number">
                <span class="adv-tts-slider-value">${state.ttsParams.exaggeration.toFixed(2)}</span>
            </div>
        </div>
         <div class="adv-tts-input-group">
            <label>CFG Weight</label>
            <div class="adv-tts-slider-group">
                <input type="range" class="adv-tts-slider" min="0" max="2" step="0.05" value="${state.ttsParams.cfgWeight}" data-key="ttsParams.cfgWeight" data-type="number">
                <span class="adv-tts-slider-value">${state.ttsParams.cfgWeight.toFixed(2)}</span>
            </div>
        </div>
        <div class="adv-tts-input-group">
            <label>Speed</label>
            <div class="adv-tts-slider-group">
                <input type="range" class="adv-tts-slider" min="0.5" max="2" step="0.05" value="${state.ttsParams.speed}" data-key="ttsParams.speed" data-type="number">
                <span class="adv-tts-slider-value">${state.ttsParams.speed.toFixed(2)}</span>
            </div>
        </div>
        <div class="adv-tts-input-group">
            <label>Seed</label>
            <input type="number" class="adv-tts-input" value="${state.ttsParams.seed}" data-key="ttsParams.seed" data-type="int">
        </div>
    `;
};

const renderVoiceProfiles = () => {
    dom.settingsProfiles.innerHTML = `
        <h2>Voice Profiles</h2>
        <div id="adv-tts-profiles-container">
        ${state.voiceProfiles.map(profile => `
            <div class="adv-tts-profile-card" data-id="${profile.id}">
                <div class="adv-tts-profile-header">
                    <input type="text" value="${profile.name}" class="adv-tts-input" placeholder="Profile Name" data-type="voice-profile" data-field="name" data-id="${profile.id}">
                    <input type="text" value="${profile.voiceId}" class="adv-tts-input" placeholder="Voice ID (e.g., Alice.wav)" data-type="voice-profile" data-field="voiceId" data-id="${profile.id}">
                    <button class="adv-tts-remove-btn" data-action="remove-voice-profile" ${state.voiceProfiles.length <= 1 ? 'disabled' : ''}>&times;</button>
                </div>
                <div class="adv-tts-overrides-table">
                    <div class="adv-tts-overrides-header">
                        <span>Content Type</span><span>Temp</span><span>Exagg</span><span>CFG</span>
                    </div>
                    ${state.delimiterRules.map(rule => `
                    <div class="adv-tts-overrides-row">
                        <span style="color: ${rule.color};">${rule.name}</span>
                        <input type="number" step="0.05" placeholder="-" value="${profile.overrides[rule.name]?.temperature ?? ''}" class="adv-tts-input" data-type="voice-profile-override" data-type-name="${rule.name}" data-param="temperature">
                        <input type="number" step="0.05" placeholder="-" value="${profile.overrides[rule.name]?.exaggeration ?? ''}" class="adv-tts-input" data-type="voice-profile-override" data-type-name="${rule.name}" data-param="exaggeration">
                        <input type="number" step="0.05" placeholder="-" value="${profile.overrides[rule.name]?.cfgWeight ?? ''}" class="adv-tts-input" data-type="voice-profile-override" data-type-name="${rule.name}" data-param="cfgWeight">
                    </div>
                    `).join('')}
                </div>
            </div>
        `).join('')}
        </div>
        <div class="adv-tts-card-actions">
            <button class="adv-tts-btn adv-tts-btn-blue" data-action="add-voice-profile">Add Profile</button>
        </div>
    `;
};

const renderDelimiterRules = () => {
    const profileOptions = state.voiceProfiles.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    dom.settingsDelimiters.innerHTML = `
        <h2>Delimiter Rules</h2>
        <div id="adv-tts-delimiters-container">
        ${state.delimiterRules.map(rule => {
            const isNarration = rule.id === 'narration-rule';
            return `
            <div class="adv-tts-rule-row" data-id="${rule.id}">
                <input type="text" class="adv-tts-input" value="${rule.name}" placeholder="Name" data-type="delimiter-rule" data-field="name" data-id="${rule.id}">
                <input type="text" class="adv-tts-input" value="${rule.start}" placeholder="Start" data-type="delimiter-rule" data-field="start" data-id="${rule.id}" ${isNarration ? 'disabled' : ''}>
                <input type="text" class="adv-tts-input" value="${rule.end}" placeholder="End" data-type="delimiter-rule" data-field="end" data-id="${rule.id}" ${isNarration ? 'disabled' : ''}>
                <select class="adv-tts-select" data-type="delimiter-rule" data-field="profileId" data-id="${rule.id}">${profileOptions}</select>
                <input type="color" value="${rule.color}" data-type="delimiter-rule" data-field="color" data-id="${rule.id}">
                <button class="adv-tts-remove-btn" data-action="remove-delimiter-rule" ${isNarration ? 'disabled style="opacity:0;"' : ''}>&times;</button>
            </div>
            `;
        }).join('')}
        </div>
        <div class="adv-tts-card-actions">
            <button class="adv-tts-btn adv-tts-btn-blue" data-action="add-delimiter-rule">Add Rule</button>
        </div>
    `;
    // Manually set select values since innerHTML doesn't always reflect them
    dom.settingsDelimiters.querySelectorAll('select').forEach(select => {
        const id = select.dataset.id;
        const rule = state.delimiterRules.find(r => r.id === id);
        if (rule) select.value = rule.profileId;
    });
};

const renderRegexRules = () => {
    const typeOptions = state.delimiterRules.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
    dom.settingsRegex.innerHTML = `
        <h2>Regex Replacements</h2>
        <div id="adv-tts-regex-container">
        ${state.regexRules.map(rule => `
            <div class="adv-tts-regex-rule-row" data-id="${rule.id}">
                <input type="checkbox" ${rule.enabled ? 'checked' : ''} data-type="regex-rule" data-field="enabled" data-id="${rule.id}">
                <input type="text" class="adv-tts-input" placeholder="Pattern (Regex)" value="${rule.pattern}" data-type="regex-rule" data-field="pattern" data-id="${rule.id}">
                <input type="text" class="adv-tts-input" placeholder="Replacement" value="${rule.replacement}" data-type="regex-rule" data-field="replacement" data-id="${rule.id}">
                <input type="text" class="adv-tts-input" placeholder="flags" value="${rule.flags}" data-type="regex-rule" data-field="flags" data-id="${rule.id}">
                <select class="adv-tts-select" data-type="regex-rule" data-field="scope" data-id="${rule.id}">
                    <option value="global">Global</option>
                    ${typeOptions}
                </select>
                <button class="adv-tts-remove-btn" data-action="remove-regex-rule">&times;</button>
            </div>
        `).join('')}
        </div>
        <div class="adv-tts-card-actions">
            <button class="adv-tts-btn adv-tts-btn-blue" data-action="add-regex-rule">Add Rule</button>
        </div>
    `;
    // Manually set select values
    dom.settingsRegex.querySelectorAll('select').forEach(select => {
        const id = select.dataset.id;
        const rule = state.regexRules.find(r => r.id === id);
        if (rule) select.value = rule.scope;
    });
};


export const render = (newState, oldState) => {
    if (newState.chunks !== oldState.chunks) renderChunks();
    if (newState.playbackQueue !== oldState.playbackQueue || newState.currentPlaybackIndex !== oldState.currentPlaybackIndex) renderPlaylist();
    if (newState.appStatus !== oldState.appStatus || newState.volume !== oldState.volume || newState.isAutoplayEnabled !== oldState.isAutoplayEnabled) renderPlaybackControls();
    if (newState.appStatus !== oldState.appStatus) renderAppStatus();
    if (newState.apiRequestLog !== oldState.apiRequestLog) renderDebugLog();
    if (newState.presets !== oldState.presets) renderPresets();

    // Settings are more complex and depend on each other, so we might re-render them more often.
    // A more advanced system would use deep comparison, but this is fine for now.
    if (newState.ttsEndpoint !== oldState.ttsEndpoint || newState.voiceId !== oldState.voiceId || newState.stripContentTags !== oldState.stripContentTags || newState.stripTagsOnly !== oldState.stripTagsOnly ) {
        renderGeneralSettings();
    }
    if (newState.ttsParams !== oldState.ttsParams) renderTtsParams();
    if (newState.voiceProfiles !== oldState.voiceProfiles || newState.delimiterRules !== oldState.delimiterRules) renderVoiceProfiles();
    if (newState.delimiterRules !== oldState.delimiterRules || newState.voiceProfiles !== oldState.voiceProfiles) renderDelimiterRules();
    if (newState.regexRules !== oldState.regexRules || newState.delimiterRules !== oldState.delimiterRules) renderRegexRules();

    if (newState.inputText !== oldState.inputText) dom.inputTextarea.value = newState.inputText;
};
