export const generateUniqueId = () => `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export const escapeRegex = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const generateCacheKey = (text, settings) => {
    const keyParts = [
        `text:${text}`,
        `v:${settings.voiceId}`,
        `t:${settings.temperature}`,
        `e:${settings.exaggeration}`,
        `c:${settings.cfgWeight}`,
        `s:${settings.seed}`,
        `sp:${settings.speed}`,
        `vm:${settings.voiceMode}`,
        `lang:${settings.language}`,
    ];
    return keyParts.join('|');
};
