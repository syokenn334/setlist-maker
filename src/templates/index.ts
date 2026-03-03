import type { SetlistTemplate } from './types.ts';
import { darkPurple } from './dark-purple.ts';
import { light } from './light.ts';
import { neon } from './neon.ts';

export const templates: SetlistTemplate[] = [darkPurple, light, neon];

export const defaultTemplate = darkPurple;

export type { SetlistTemplate };
