import Ember from 'ember';

const { computed, get, run, $ } = Ember;

// https://github.com/emberjs/rfcs/issues/168
export default function getParent(view) {
  if (get(view, 'tagName') === '') {
    // Beware: use of private API! :(
    if (Ember.ViewUtils && Ember.ViewUtils.getViewBounds) {
      return $(Ember.ViewUtils.getViewBounds(view).parentElement);
    } else {
      return $(view._renderNode.contextualElement);
    }
  } else {
    return view.$().parent();
  }
}

export const INTERACTION_EVENT_TYPES = ['mouseenter', 'click', 'focusin'];

const PASSABLE_PROPERTIES = [
	'delay',
	'delayOnChange',
	'duration',
	'effect',
	'event',
	'hideOn',
	'keepInWindow',
	'side',
	'showOn',
	'spacing',
	'isShown',
	'tooltipIsVisible',
	'hideDelay',
	'target',

	// non-publicized attributes
	'updateFor',
	'targetAttachment',
	'attachment',
	'role',
	'tabindex',
];

const PASSABLE_ACTIONS = [
	'onDestroy',
	'onHide',
	'onRender',
	'onShow',

	// deprecated lifecycle actions
	'onTooltipDestroy',
	'onTooltipHide',
	'onTooltipRender',
	'onTooltipShow',
];

const PASSABLE_OPTIONS = PASSABLE_PROPERTIES.concat(PASSABLE_ACTIONS);

export default Ember.Component.extend({
	tagName: '',

	passedPropertiesObject: computed(...PASSABLE_OPTIONS, function() {
		// TODO write unit tests for passedPropertiesObject

		return PASSABLE_OPTIONS.reduce((passablePropertiesObject, key) => {
			// if a property has been declared by Component extension ( TooltipOnElement.extend )
			// or by handlebars instantiation ( {{tooltip-on-element}} ) then that property needs
			// to be passed from this wrapper to the lazy-rendered tooltip or popover component

			let value = this.get(key);

			if (!Ember.isNone(value)) {
				if (PASSABLE_ACTIONS.indexOf(key) >= 0) {
					// if a user has declared a lifecycle action property (onShow='someFunc')
					// then we must pass down the correctly-scoped action instead of value

					passablePropertiesObject[key] = () => this.sendAction(key);
				} else {
					passablePropertiesObject[key] = value;
				}
			}

			return passablePropertiesObject;
		}, {});
	}),

	enableLazyRendering: false, // TODO add docs for this
	_hasUserInteracted: false,
	_hasRendered: false,
	_shouldRender: computed('isShown', 'tooltipIsVisible', 'enableLazyRendering', '_hasUserInteracted', function() {
		// if isShown, tooltipIsVisible, !enableLazyRendering, or _hasUserInteracted then
		// we return true and change _shouldRender from a computed property to a boolean.
		// We do this because there is never a scenario where this wrapper should destroy the tooltip

		const returnTrueAndEnsureAlwaysRendered = () => {
			this.set('_shouldRender', true);
			return true;
		};

		if (this.get('isShown') || this.get('tooltipIsVisible')) {

			return returnTrueAndEnsureAlwaysRendered();

		} else if (!this.get('enableLazyRendering')) {

			return returnTrueAndEnsureAlwaysRendered();

		} else if (this.get('_hasUserInteracted')) {

			return returnTrueAndEnsureAlwaysRendered();

		}

		return false;
	}),

	didInsertElement() {
		this._super(...arguments);

		if (this.get('_shouldRender')) {
			// if the tooltip _shouldRender then we don't need
			// any special $parent event handling
			return;
		}

		const $parent = getParent(this);

		INTERACTION_EVENT_TYPES.forEach((eventType) => {
			$parent.on(`${eventType}.lazy-ember-popover`, () => {
				if (this.get('_hasUserInteracted')) {
					$parent.off(`${eventType}.lazy-ember-popover`);
				} else {
					this.set('_hasUserInteracted', true);
					run.next(() => {
						$parent.trigger(eventType);
					});
				}
			});
		});
	},

	willDestroyElement() {
		this._super(...arguments);

		const $parent = getParent(this);
		INTERACTION_EVENT_TYPES.forEach((eventType) => {
			$parent.off(`${eventType}.lazy-ember-popover`);
		});
	},
});
