import { Probot } from 'probot';
import { ReviewRun } from './contracts.js';
export declare const eventMatchesMode: (payload: any, mode: ReviewRun['mode']) => boolean;
export declare const robot: (app: Probot) => void;
