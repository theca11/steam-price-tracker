import streamDeck from '@elgato/streamdeck';
import { PriceTracker } from './actions/tracker';

streamDeck.actions.registerAction(new PriceTracker());
streamDeck.connect();