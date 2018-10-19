'use strict';

const Transition = class {
  /**
   * @this {StateMachineInterface}
   * @param {Object=} detail
   * @return {!boolean}
   */
  condition(detail) {}

  /**
   * @this {StateMachineInterface}
   * @param {Object=} detail
   */
  action(detail) {}
};

/** @type {!string} */
Transition.prototype.event;

/** @type {!string} */
Transition.prototype.target;

const State = class {
  /** @this {StateMachineInterface} */
  onEntry() {}
  /** @this {StateMachineInterface} */
  onExit() {}
};
/** @type {!string} */
State.prototype.name;
/** @type {Array<Transition>} */
State.prototype.transitions;

/** @interface */
const StateMachineInterface = class {

  /**
   * @param {!State} state
   * @param {!State} desired
   * @return {boolean}
   */
  isState(state, desired) {}

  /**
   * @param {!State} state
   * @param {...State} states
   * @return {boolean}
   */
  oneOfState(state, ...states) {}

  /**
   * @param {!string} eventName
   * @param {Object=} detail
   */
  send(eventName, detail) {}

  /**
   * @private
   * @param {!State} state
   */
  initializeState_(state) {}

  /**
   * @description attempt to transition to the next state
   * @private
   * @param {?State} newState
   */
  transitionTo_(newState) {}

  /**
   * @private
   * @param {!string} name
   * @return {?State}
   */
  getStateByName_(name) {}
};

/** @type {!string} */
StateMachineInterface.prototype.state;

/** @type {!State} */
StateMachineInterface.prototype.currentState;

/** @type {!State} */
StateMachineInterface.prototype.initialState;

/** @type {!Object<State>} */
StateMachineInterface.prototype.states;

/**
 * @mixinFunction
 * @polymer
 * @param {function(new:Polymer.Element)} Superclass
 */
function stateMachineMixin(Superclass) {
  /**
   * @mixinClass
   * @polymer
   * @implements {StateMachineInterface}
   */
  class StateMachine extends Superclass {

    static get properties() {
      return {
        state: {
          type: String,
          reflectToAttribute: false,
          notify: true,
          readOnly: true
        },
        /** @type {!Object<State>} */
        states: {
          type: Object,
          readOnly: true,
          value: () => ({})
        },
        /** @type {!State} */
        initialState: Object,
        /** @type {!State} */
        currentState: Object,
      };
    }

    constructor() {
      super();
      this.initializeState_(this.initialState);
    }

    /**
     * @param {!State} state
     * @param {!State} desired
     * @return {boolean}
     */
    isState(state, desired) {
      return state === desired;
    }

    /**
     * @param {!State} state
     * @param {...State} states
     * @return {boolean}
     */
    oneOfState(state, ...states) {
      return states.includes(state);
    }

    /**
     * @description sends an event that our state machine consumes
     * @param {!string} eventName
     * @param {Object=} detail
     */
    send(eventName, detail = {}) {
      // TODO: first error can probably go away with Closure Compiler in play.
      if (!eventName) {
        throw new Error('an event name is required to send!');
      }
      if (!this.currentState) {
        throw new Error(`cannot send with no state: ${eventName}`);
      }
      // find the appropriate transitions in the current state
      const transitions = this.currentState.transitions.filter(t => t.event === eventName);
      // no matching transitions in this state
      if (transitions.length === 0) {
        console.warn(`no transitions found in current state: "${this.state}" for event: "${eventName}"`);
        return;
      }
      // with multiple transitions handling the same event,
      // check each transition for conditions and throw an error,
      // for now, if any transition does not have a condition.
      if (transitions.length > 1 && transitions.filter(t => !t.condition).length > 0) {
        throw new Error(
          `multiple transitions found without a condition for event: ${eventName} in state: ${this.state}`);
      }
      // if multiple transitions, run the first one that has a condition that returns true.
      if (transitions.length > 1) {
        transitions.some(t => {
          const passed = t.condition.call(this, detail);
          if (passed) {
            // run the first passing transition
            // before running, run the transition's action
            if (t.action) {
              t.action.call(this, detail);
            }
            this.transitionTo_(this.getStateByName_(t.target));
          }
          return passed;// break out of loop if true, before testing more conditions
        });
      } else {
        // only one transition, check for condition first
        const transition = transitions[0];
        const targetState = this.getStateByName_(transition.target);

        // go for it if no condition
        if (!transition.condition) {
          if (transition.action) {
            transition.action.call(this, detail);
          }
          this.transitionTo_(targetState);
        } else if (transition.condition.call(this, detail)) {
          // if the transition does have a condition,
          // transitionTo_ if it returns true
          if (transition.action) {
            transition.action.call(this, detail);
          }
          this.transitionTo_(targetState);
        }
      }
    }

    /**
     * @private
     * @param {!State} initial
     */
    initializeState_(initial) {
      this.transitionTo_(initial);
    }

    /**
     * @description attempt to transition to the next state
     * @private
     * @param {?State} newState
     */
    transitionTo_(newState) {
      if (!newState) {
        console.error(`transitionTo_ called with no State`);
        return;
      }
      if (newState === this.currentState) {
        this._setState('');// trigger 'change' in polymer
      }
      // call onExit if exists
      if (this.currentState && this.currentState.onExit) {
        this.currentState.onExit.call(this);
      }
      this.currentState = newState;
      // "state" property is readonly, use special polymer method to set
      this._setState(newState.name);
      // call onEntry if it exists
      if (newState.onEntry) {
        newState.onEntry.call(this);
      }
    }

    /**
     * @private
     * @param {!string} name
     * @return {?State}
     */
    getStateByName_(name) {
      return Object.values(this.states).find(s => s.name === name) || null;
    }

  }
  return StateMachine;
}

// module.exports = stateMachineMixin;
// module.exports.Type = StateMachineInterface;
// module.exports.TransitionType = Transition;
// module.exports.StateType = State;

// create a namespace
if (!window.PolyMachine) {
  window.PolyMachine = {};
}
window.PolyMachine.PolyMachineMixin = stateMachineMixin;
