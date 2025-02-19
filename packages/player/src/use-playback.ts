import {useEffect, useRef} from 'react';
import {Internals} from 'remotion';
import {usePlayer} from './use-player';

export const usePlayback = ({loop}: {loop: boolean}) => {
	const frame = Internals.Timeline.useTimelinePosition();
	const config = Internals.useUnsafeVideoConfig();
	const {playing, pause, emitter} = usePlayer();
	const setFrame = Internals.Timeline.useTimelineSetFrame();
	const {
		inFrame,
		outFrame,
	} = Internals.Timeline.useTimelineInOutFramePosition();

	const frameRef = useRef(frame);
	frameRef.current = frame;

	const lastTimeUpdateEvent = useRef<number | null>(null);

	useEffect(() => {
		if (!config) {
			return;
		}

		if (!playing) {
			return;
		}

		const getFrameInRange = (nextFrame: number) => {
			if (
				(inFrame && nextFrame < inFrame) ||
				(inFrame && outFrame && nextFrame > outFrame)
			) {
				return inFrame;
			}

			if (outFrame && nextFrame > outFrame) {
				return 0;
			}

			return nextFrame;
		};

		let hasBeenStopped = false;
		let reqAnimFrameCall: number | null = null;
		const startedTime = performance.now();
		const startedFrame = getFrameInRange(frameRef.current);

		const durationInFrames = (() => {
			if (inFrame !== null && outFrame !== null) {
				return outFrame - inFrame + 1;
			}

			if (inFrame !== null) {
				return config.durationInFrames - inFrame;
			}

			if (outFrame !== null) {
				return outFrame + 1;
			}

			return config.durationInFrames;
		})();

		const stop = () => {
			hasBeenStopped = true;
			if (reqAnimFrameCall !== null) {
				cancelAnimationFrame(reqAnimFrameCall);
			}
		};

		const callback = () => {
			const time = performance.now() - startedTime;
			const nextFrame =
				Math.round(time / (1000 / config.fps)) + startedFrame - (inFrame ?? 0);
			if (nextFrame === config.durationInFrames && !loop) {
				stop();
				pause();
				emitter.dispatchEnded();
				return;
			}

			const actualNextFrame = (nextFrame % durationInFrames) + (inFrame ?? 0);

			if (actualNextFrame !== frameRef.current) {
				setFrame(actualNextFrame);
			}

			if (!hasBeenStopped) {
				reqAnimFrameCall = requestAnimationFrame(callback);
			}
		};

		reqAnimFrameCall = requestAnimationFrame(callback);

		return () => {
			stop();
		};
	}, [config, loop, pause, playing, setFrame, emitter, inFrame, outFrame]);

	useEffect(() => {
		const interval = setInterval(() => {
			if (lastTimeUpdateEvent.current === frameRef.current) {
				return;
			}

			emitter.dispatchTimeUpdate({frame: frameRef.current as number});
			lastTimeUpdateEvent.current = frameRef.current;
		}, 250);

		return () => clearInterval(interval);
	}, [emitter]);
};
