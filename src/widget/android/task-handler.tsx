import * as Crypto from 'expo-crypto';
import { requestWidgetUpdate, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { idToken, nextTargetId, postAddPoints, resolveTarget, WidgetApiError, withPoints, type WidgetState } from '../core';
import { androidWidgetStore as store } from './storage';
import { ANDROID_WIDGETS, renderAndroidWidget } from './widgets';

async function props() {
  const [state, chosen, error] = await Promise.all([store.state(), store.target(), store.error()]);
  return { state, target: state ? resolveTarget(state, chosen) : ({ kind: 'solo' } as const), error };
}

/** Redraw every Contact 10 widget on the home screen. */
export async function refreshAndroidWidgets() {
  const p = await props();
  for (const name of Object.keys(ANDROID_WIDGETS)) {
    await requestWidgetUpdate({ widgetName: name, renderWidget: () => renderAndroidWidget(name, p) });
  }
}

async function addPoints(state: WidgetState, chosen: string | null, amount: number) {
  const target = resolveTarget(state, chosen);
  const gameId = target.kind === 'game' ? target.game.id : null;
  const entry = { entryId: Crypto.randomUUID(), gameId, amount };
  await store.setError(null);
  await store.setState(withPoints(state, gameId, amount));
  await refreshAndroidWidgets();
  try {
    const token = await idToken(state, store.tokenCache);
    const result = await postAddPoints(state, token, entry);
    const latest = (await store.state()) ?? state;
    await store.setState({
      ...latest,
      lifetimePoints: result.lifetimePoints,
      games: latest.games.map((g) => (g.id === gameId && result.gamePoints !== null ? { ...g, points: result.gamePoints } : g)),
    });
  } catch (err) {
    if (err instanceof WidgetApiError && !err.network) {
      await store.setState(state);
      await store.setError(err.message);
    } else {
      // Offline: keep the shown total and let the app deliver it later.
      await store.setPending([...(await store.pending()), entry]);
    }
  }
}

export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return;
  const state = await store.state();
  if (widgetAction === 'WIDGET_CLICK' && state) {
    if (clickAction === 'CYCLE') {
      await store.setTarget(nextTargetId(state, resolveTarget(state, await store.target())));
      await store.setError(null);
      await refreshAndroidWidgets();
    } else if (clickAction === 'ADD') {
      const amount = Number(clickActionData?.amount);
      if (Number.isInteger(amount) && amount >= 1 && amount <= 100) await addPoints(state, await store.target(), amount);
      await refreshAndroidWidgets();
    }
  }
  renderWidget(renderAndroidWidget(widgetInfo.widgetName, await props()));
}
