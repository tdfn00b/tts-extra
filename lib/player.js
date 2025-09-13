import { state, setState } from '../state.js';

let dom = {};
let audio = null;

export const init = (domElements) => {
    dom = domElements;
    audio = new Audio();
    audio.volume = state.volume;

    audio.onended = () => {
        const newIndex = state.currentPlaybackIndex + 1;
        if (newIndex < state.playbackQueue.length) {
            setState({ currentPlaybackIndex: newIndex });
            play();
        } else {
            // Reached end of queue
            setState({ appStatus: 'ready', currentPlaybackIndex: -1 });
        }
    };

    audio.onplay = () => {
        if (state.appStatus !== 'playing') {
            setState({ appStatus: 'playing' });
        }
    };

    audio.onpause = () => {
        // Only set to 'paused' if it wasn't intentionally stopped or finished
        if (state.appStatus === 'playing') {
            setState({ appStatus: 'paused' });
        }
    };
};

const playCurrentChunk = () => {
    if (state.currentPlaybackIndex < 0 || state.currentPlaybackIndex >= state.playbackQueue.length) {
        stop();
        return;
    }

    const chunkToPlay = state.playbackQueue[state.currentPlaybackIndex];
    
    if (chunkToPlay?.status === 'ready' && chunkToPlay.audioUrl) {
        if (audio.src !== chunkToPlay.audioUrl) {
            audio.src = chunkToPlay.audioUrl;
        }
        audio.play().catch(e => {
            console.error("Audio play failed:", e);
            skip(); // Try next chunk
        });
    } else if (chunkToPlay?.status === 'loading') {
        // It's not ready yet, pause playback and wait for state update to trigger play again
        setState({ appStatus: 'paused' });
    } else { 
        // Skip error, pending, or invalid chunks
        skip();
    }
};

export const play = () => {
    let newIndex = state.currentPlaybackIndex;
    if (newIndex < 0) {
        newIndex = 0;
    }
    
    if (newIndex >= state.playbackQueue.length) {
        // If trying to play but at the end, reset to start
        newIndex = 0;
    }
    
    setState({ appStatus: 'playing', currentPlaybackIndex: newIndex });
    playCurrentChunk();
};

export const pause = () => {
    audio.pause();
    setState({ appStatus: 'paused' });
};

export const stop = () => {
    audio.pause();
    audio.src = '';
    setState({ appStatus: 'idle', currentPlaybackIndex: -1 });
};

export const togglePlayPause = () => {
    if (state.appStatus === 'playing') {
        pause();
    } else {
        play();
    }
};

export const skip = () => {
    if (state.playbackQueue.length > 0) {
        const newIndex = Math.min(state.currentPlaybackIndex + 1, state.playbackQueue.length);
        setState({ currentPlaybackIndex: newIndex });
        if(state.appStatus === 'playing') playCurrentChunk();
    }
};

export const rewind = () => {
    if (state.playbackQueue.length > 0) {
        const newIndex = Math.max(state.currentPlaybackIndex - 1, 0);
        setState({ currentPlaybackIndex: newIndex });
        if(state.appStatus === 'playing') playCurrentChunk();
    }
};

export const replayAll = () => {
    if (state.playbackQueue.length > 0) {
        setState({ currentPlaybackIndex: 0, appStatus: 'playing' });
        playCurrentChunk();
    }
};

export const setVolume = (newVolume) => {
    const volume = Math.max(0, Math.min(1, newVolume));
    audio.volume = volume;
    setState({ volume });
};
