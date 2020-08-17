import getDistance from 'gl-vec2/distance';
import EventEmitter from 'eventemitter3';
import dprop from 'dprop';
import eventOffset from 'mouse-event-offset';
import hasPassive from 'has-passive-events';

/**
 * This file is a fork of touch-pinch npm module with
 * event dispatching for start and end events.
 */

var eventOptions = hasPassive
  ? { capture: false, passive: true }
  : false;

function touchPinch (target) {
  target = target || window;

  var emitter = new EventEmitter();
  var fingers = [ null, null ];
  var activeCount = 0;

  var lastDistance = 0;
  var ended = false;
  var enabled = false;

  // some read-only values
  Object.defineProperties(emitter, {
    pinching: dprop(function () {
      return activeCount === 2;
    }),

    fingers: dprop(function () {
      return fingers;
    })
  });

  enable();
  emitter.enable = enable;
  emitter.disable = disable;
  emitter.indexOfTouch = indexOfTouch;
  return emitter;

  function indexOfTouch (touch) {
    var id = touch.identifier;
    for (var i = 0; i < fingers.length; i++) {
      if (fingers[i] &&
        fingers[i].touch &&
        fingers[i].touch.identifier === id) {
        return i;
      }
    }
    return -1;
  }

  function enable () {
    if (enabled) return;
    enabled = true;
    target.addEventListener('touchstart', onTouchStart, eventOptions);
    target.addEventListener('touchmove', onTouchMove, eventOptions);
    target.addEventListener('touchend', onTouchRemoved, eventOptions);
    target.addEventListener('touchcancel', onTouchRemoved, eventOptions);
  }

  function disable () {
    if (!enabled) return;
    enabled = false;
    activeCount = 0;
    fingers[0] = null;
    fingers[1] = null;
    lastDistance = 0;
    ended = false;
    target.removeEventListener('touchstart', onTouchStart, eventOptions);
    target.removeEventListener('touchmove', onTouchMove, eventOptions);
    target.removeEventListener('touchend', onTouchRemoved, eventOptions);
    target.removeEventListener('touchcancel', onTouchRemoved, eventOptions);
  }

  function onTouchStart (ev) {
    for (var i = 0; i < ev.changedTouches.length; i++) {
      var newTouch = ev.changedTouches[i];
      var id = newTouch.identifier;
      var idx = indexOfTouch(id);

      if (idx === -1 && activeCount < 2) {
        var first = activeCount === 0;

        // newest and previous finger (previous may be undefined)
        var newIndex = fingers[0] ? 1 : 0;
        var oldIndex = fingers[0] ? 0 : 1;
        var newFinger = new Finger();

        // add to stack
        fingers[newIndex] = newFinger;
        activeCount++;

        // update touch event & position
        newFinger.touch = newTouch;
        eventOffset(newTouch, target, newFinger.position);

        var oldTouch = fingers[oldIndex] ? fingers[oldIndex].touch : undefined;
        emitter.emit('place', newTouch, oldTouch);

        if (!first) {
          var initialDistance = computeDistance();
          ended = false;
          emitter.emit('start', initialDistance);
          lastDistance = initialDistance;
        }
      }
    }
  }

  function onTouchMove (ev) {
    var changed = false;
    for (var i = 0; i < ev.changedTouches.length; i++) {
      var movedTouch = ev.changedTouches[i];
      var idx = indexOfTouch(movedTouch);
      if (idx !== -1) {
        changed = true;
        fingers[idx].touch = movedTouch; // avoid caching touches
        eventOffset(movedTouch, target, fingers[idx].position);
      }
    }

    if (activeCount === 2 && changed) {
      var currentDistance = computeDistance();
      emitter.emit('change', currentDistance, lastDistance);
      lastDistance = currentDistance;
    }
  }

  function onTouchRemoved (ev) {
    for (var i = 0; i < ev.changedTouches.length; i++) {
      var removed = ev.changedTouches[i];
      var idx = indexOfTouch(removed);

      if (idx !== -1) {
        fingers[idx] = null;
        activeCount--;
        var otherIdx = idx === 0 ? 1 : 0;
        var otherTouch = fingers[otherIdx] ? fingers[otherIdx].touch : undefined;
        emitter.emit('lift', removed, otherTouch);
      }
    }

    if (!ended && activeCount !== 2) {
      ended = true;
      emitter.emit('end');
    }
  }

  function computeDistance () {
    if (activeCount < 2) return 0;
    return getDistance(fingers[0].position, fingers[1].position);
  }
}

function Finger () {
  this.position = [0, 0];
  this.touch = null;
}

export default touchPinch;
