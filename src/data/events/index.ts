import { extendedLifeEvents } from './extendedLifeEvents';
import { educationCareerEvents } from './educationCareerEvents';
import { lifeEvents } from './lifeEvents';
import { historicalEvents } from './historicalEvents';
import { calendarEvents } from './calendarEvents';
import { digitalEvents } from './digitalEvents';
import type { LifeEvent } from '../../types/game';

export {
  lifeEvents,
  extendedLifeEvents,
  educationCareerEvents,
  historicalEvents,
  calendarEvents,
  digitalEvents,
};
const eventCatalog: LifeEvent[] = [
  ...lifeEvents,
  ...extendedLifeEvents,
  ...educationCareerEvents,
  ...historicalEvents,
  ...calendarEvents,
  ...digitalEvents,
];

export const lifeEventLibrary = eventCatalog.map((event) => (
  event.historicalClassification
    ? event
    : {
      ...event,
      fictional: true,
      historicalClassification: 'fictional_personal' as const,
    }
));
