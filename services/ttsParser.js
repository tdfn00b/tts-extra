import { generateUniqueId, escapeRegex } from './utils.js';

export const applyRegexReplacements = (text, type, rules) => {
    let processedText = text;
    rules.forEach(rule => {
        if (rule.enabled && (rule.scope === 'global' || rule.scope === type)) {
            try {
                const regex = new RegExp(rule.pattern, rule.flags);
                processedText = processedText.replace(regex, rule.replacement);
            } catch (e) {
                console.error(`Invalid regex pattern: "${rule.pattern}".`, e);
            }
        }
    });
    return processedText;
};

export const sanitizeTextForApi = (text) => {
    let processedText = text.replace(/\\"/g, '"').replace(/\s+/g, ' ').trim();
    const firstChar = processedText.charAt(0);
    const lastChar = processedText.charAt(processedText.length - 1);
    if (firstChar === lastChar && processedText.length > 1 && ['"', "'", "`", "*", "_"].includes(firstChar)) {
        processedText = processedText.substring(1, processedText.length - 1);
    }
    return processedText.trim();
};

export const parseTextForTTS = (
    rawText,
    stripContentTags,
    stripTagsOnly,
    delimiterRules
) => {
    let processedText = rawText;
    const contentTags = stripContentTags.split(',').map(t => t.trim()).filter(Boolean);
    if (contentTags.length > 0) {
        const contentRegex = new RegExp(contentTags.map(tag => `<${tag}[^>]*>.*?<\\/${tag}>`).join('|'), 'gis');
        processedText = processedText.replace(contentRegex, '');
    }

    const tagsOnly = stripTagsOnly.split(',').map(t => t.trim()).filter(Boolean);
    if (tagsOnly.length > 0) {
        const tagsOnlyRegex = new RegExp(tagsOnly.map(tag => `</?${tag}[^>]*>`).join('|'), 'gi');
        processedText = processedText.replace(tagsOnlyRegex, '');
    }

    const paragraphs = processedText.split(/[\r\n]+/).filter(p => p.trim() !== '');
    const allChunks = [];

    const narrationRule = delimiterRules.find(rule => !rule.start && !rule.end) || { name: 'narration', color: '#aaaaaa' };
    const activeRules = delimiterRules.filter(rule => rule.start && rule.end);

    paragraphs.forEach((paragraphText, paragraphIndex) => {
        if (activeRules.length === 0) {
            const trimmedText = paragraphText.trim();
            if (trimmedText) {
                allChunks.push({
                    text: trimmedText,
                    type: narrationRule.name,
                    color: narrationRule.color,
                    id: generateUniqueId(),
                    paragraphId: paragraphIndex,
                    status: 'pending',
                });
            }
            return;
        }

        const regexParts = activeRules.map(rule => `(${escapeRegex(rule.start)}[\\s\\S]*?${escapeRegex(rule.end)})`);
        const placeholderRegex = new RegExp(regexParts.join('|'), 'g');
        
        const chunksMap = {};
        let chunkIndex = 0;

        const textWithPlaceholders = paragraphText.replace(placeholderRegex, (match) => {
            const rule = activeRules.find(r => match.startsWith(r.start) && match.endsWith(r.end));
            if (rule) {
                const placeholder = `%%CHUNK_${chunkIndex}%%`;
                chunksMap[placeholder] = { text: match, type: rule.name, color: rule.color };
                chunkIndex++;
                return placeholder;
            }
            return match;
        });

        const paragraphChunks = [];
        textWithPlaceholders.split(/(%%CHUNK_\d+%%)/g).forEach(part => {
            if (part.startsWith('%%CHUNK_')) {
                if (chunksMap[part]) paragraphChunks.push(chunksMap[part]);
            } else {
                const trimmedPart = part.trim();
                if (trimmedPart) paragraphChunks.push({ text: trimmedPart, type: narrationRule.name, color: narrationRule.color });
            }
        });

        paragraphChunks.forEach(chunk => {
            const trimmedText = chunk.text.trim();
            if (trimmedText && !/^[\s.,!?;:'"-]+$/.test(trimmedText)) {
                allChunks.push({
                    ...chunk,
                    id: generateUniqueId(),
                    paragraphId: paragraphIndex,
                    status: 'pending',
                });
            }
        });
    });

    return allChunks;
};
