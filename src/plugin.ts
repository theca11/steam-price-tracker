import streamDeck from '@elgato/streamdeck';
import { PriceTracker } from './actions/PriceTracker';

streamDeck.actions.registerAction(new PriceTracker());
streamDeck.connect();