import i18next from 'i18next';

const t = (...args) => {
    const key = args[0];
    const options = args[1];

    let text = i18next.t(key, options) as unknown as string;
    if (typeof text === 'string' && text.length === 0) {
        text = i18next.t(key, { ...options, lng: 'en' }) as unknown as string;
    }

    return text;
};

interface TranslateOptions {
    lng?: string;
    defaultValue?: string;
    context?: string;
    count?: number;
}

function processKey(value: string, options: TranslateOptions = {}): string {
    const { context, count } = options;
    const containsContext = (context !== undefined) && (context !== null);
    const containsPlural = (typeof count === 'number');

    if (containsContext) {
        value = value + i18next.options.contextSeparator + options.context;
    }
    if (containsPlural) {
        value = `${value}${i18next.options.pluralSeparator}plural`;
    }

    return value;
    // return sha1(value);
}

const _ = (value: string = '', options: TranslateOptions = {}): string => {
    const key = processKey(value, options);

    options.defaultValue = value;

    let text = i18next.t(key, options) as unknown as string;
    if (typeof text !== 'string' || text.length === 0) {
        text = i18next.t(key, { ...options, lng: 'en' }) as unknown as string;
    }

    return text;
};

const clearCookies = () => {
    window.document.cookie
        .split(';')
        .forEach((cookie) => {
            document.cookie = `${cookie.replace(/(.+=)([\s\S]*)/ig, '$1').trim()};expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        });
};

export default {
    t,
    _,
    clearCookies
};
