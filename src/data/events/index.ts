import { extendedLifeEvents } from './extendedLifeEvents';
import { educationCareerEvents } from './educationCareerEvents';
import { lifeEvents } from './lifeEvents';

export { lifeEvents, extendedLifeEvents, educationCareerEvents };
export const lifeEventLibrary = [...lifeEvents, ...extendedLifeEvents, ...educationCareerEvents];
