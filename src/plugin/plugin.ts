import streamDeck from '@elgato/streamdeck';
import { PriceTracker } from './PriceTracker';

streamDeck.actions.registerAction(new PriceTracker());
streamDeck.connect()
.then(() => {
	return streamDeck.settings.getGlobalSettings();
})
.catch(() => console.error('Error connecting to Stream Deck'));
