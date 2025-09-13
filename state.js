import { generateUniqueId } from './services/utils.js';

// The single source of truth for the application's state.
export let state = {
    // App status
    appStatus: 'idle', // 'idle', 'preparing', 'ready', 'playing', 'paused'
    
    // Core settings from presets
    inputText: `This is the first paragraph. It contains some narration, "and then some speech." Finally, it ends.\n\nThis is the second paragraph. *It starts with a thought.* Then, more narration follows. "And it concludes with more speech."\n\nA third paragraph with only a single divine message: \`This is it.\``,
    ttsEndpoint: 'https://your-endpoint.ngrok-free.app/tts',
    voiceId: 'Emily.wav',
    stripContentTags: 'details',
    stripTagsOnly: 'span,em,strong,b,i',
    voiceProfiles: [
        { id: 'profile-default', name: 'Default', voiceId: 'Emily.wav', overrides: {} },
        { id: 'profile-excited', name: 'Excited Alice', voiceId: 'Alice.wav', overrides: { 'speech': { temperature: 0.8, exaggeration: 1.2 } } }
    ],
    delimiterRules: [
        { id: 'narration-rule', name: 'narration', start: '', end: '', color: '#9CA3AF', profileId: 'profile-default' },
        { id: '1', name: 'speech', start: '"', end: '"', color: '#60A5FA', profileId: 'profile-default' },
        { id: '2', name: 'thought', start: '*', end: '*', color: '#A78BFA', profileId: 'profile-default' },
        { id: '3', name: 'God', start: '`', end: '`', color: '#FBBF24', profileId: 'profile-excited' },
    ],
    regexRules: [
        { id: generateUniqueId(), enabled: true, pattern: '¥', replacement: 'Yen', flags: 'g', scope: 'global' }
    ],
    ttsParams: { temperature: 0.5, exaggeration: 0.5, cfgWeight: 0.2, seed: 0, speed: 1.0 },
    advancedTtsSettings: { voiceMode: 'predefined', splitText: true, chunkSize: 120, language: 'en' },
    
    // Presets
    presets: {},

    // Generation and playback
    chunks: [],
    playbackQueue: [],
    currentPlaybackIndex: -1, // -1 means nothing is selected/playing
    selectedChunkTypes: new Set(['narration', 'speech', 'thought', 'God']),
    generationStrategy: 'smart-group',
    isAutoplayEnabled: true,
    volume: 1,

    // Abort controller for fetch requests
    abortController: new AbortController(),
    
    // UI State
    apiRequestLog: [],
    isDebugVisible: false,
};

// --- Simple Pub/Sub for State Changes ---
const subscribers = new Set();

/**
 * Subscribes a callback function to state changes.
 * @param {Function} callback - The function to call when state is updated.
 */
export const subscribe = (callback) => {
    subscribers.add(callback);
    // Return an unsubscribe function
    return () => subscribers.delete(callback);
};

/**
 * Updates the global state and notifies all subscribers.
 * @param {Partial<state> | ((prevState: typeof state) => Partial<typeof state>)} newStateOrFn - An object with new state values or a function that returns one.
 */
export const setState = (newStateOrFn) => {
    const oldState = { ...state };
    const newState = typeof newStateOrFn === 'function' ? newStateOrFn(oldState) : newStateOrFn;
    
    state = { ...oldState, ...newState };
    
    // Notify subscribers about the update
    for (const callback of subscribers) {
        callback(state, oldState);
    }
};
