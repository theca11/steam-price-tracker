import { JsonObject, KeyDownEvent, KeyUpEvent, SingletonAction } from '@elgato/streamdeck';


export abstract class AbstractAction<T extends JsonObject> extends SingletonAction<T> {
	private _pressCache = new Map<string, NodeJS.Timeout>(); // <context, timeoutRef>

	protected onSinglePress?(ev: KeyUpEvent<T>): void | Promise<void>;
	protected onLongPress?(ev: KeyDownEvent<T>): void | Promise<void>;

	override onKeyDown(evtData: KeyDownEvent<T>) {
		const context = evtData.action.id;

		if (this._pressCache.has(context)) return;

		const timeout = setTimeout(() => {
			this._pressCache.delete(context);
			if (this.onLongPress) this.onLongPress(evtData);
		}, 500);
		this._pressCache.set(context, timeout);
	}

	override onKeyUp(evtData: KeyUpEvent<T>) {
		const context = evtData.action.id;
		if (!this._pressCache.has(context)) return;
		clearTimeout(this._pressCache.get(context));
		this._pressCache.delete(context);
		if (this.onSinglePress) this.onSinglePress(evtData);
	}
}

