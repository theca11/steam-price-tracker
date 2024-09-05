import streamDeck from '@elgato/streamdeck';
import { PriceTracker } from './actions/PriceTracker';

streamDeck.actions.registerAction(new PriceTracker());
await streamDeck.connect();
streamDeck.settings.getGlobalSettings();