import config from './analytics.config.json';

export const ANALYTICS = config;

// GitHub Pages serves a static export, so the browser contacts Umami directly.
export const TRACKER_SRC = `${config.host}/script.js`;
