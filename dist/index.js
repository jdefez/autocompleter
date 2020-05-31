(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.Autocompleter = factory());
}(this, (function () { 'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        if (value != null || input.value) {
            input.value = value;
        }
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    class HtmlTag {
        constructor(html, anchor = null) {
            this.e = element('div');
            this.a = anchor;
            this.u(html);
        }
        m(target, anchor = null) {
            for (let i = 0; i < this.n.length; i += 1) {
                insert(target, this.n[i], anchor);
            }
            this.t = target;
        }
        u(html) {
            this.e.innerHTML = html;
            this.n = Array.from(this.e.childNodes);
        }
        p(html) {
            this.d();
            this.u(html);
            this.m(this.t, this.a);
        }
        d() {
            this.n.forEach(detach);
        }
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    let SvelteElement;
    if (typeof HTMLElement === 'function') {
        SvelteElement = class extends HTMLElement {
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
            }
            connectedCallback() {
                // @ts-ignore todo: improve typings
                for (const key in this.$$.slotted) {
                    // @ts-ignore todo: improve typings
                    this.appendChild(this.$$.slotted[key]);
                }
            }
            attributeChangedCallback(attr, _oldValue, newValue) {
                this[attr] = newValue;
            }
            $destroy() {
                destroy_component(this, 1);
                this.$destroy = noop;
            }
            $on(type, callback) {
                // TODO should this delegate to addEventListener?
                const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
                callbacks.push(callback);
                return () => {
                    const index = callbacks.indexOf(callback);
                    if (index !== -1)
                        callbacks.splice(index, 1);
                };
            }
            $set() {
                // overridden by instance, if it has props
            }
        };
    }

    /* src/Autocompleter.svelte generated by Svelte v3.22.3 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[30] = list[i];
    	child_ctx[32] = i;
    	return child_ctx;
    }

    // (212:2) {#each dataList as item, i }
    function create_each_block(ctx) {
    	let span;
    	let html_tag;
    	let raw_value = /*renderListItemContent*/ ctx[11](/*renderlistitem*/ ctx[2], /*item*/ ctx[30]) + "";
    	let t;
    	let dispose;

    	return {
    		c() {
    			span = element("span");
    			t = space();
    			html_tag = new HtmlTag(raw_value, t);
    			attr(span, "class", "list-item");
    			toggle_class(span, "is--highlighted", /*i*/ ctx[32] === /*index*/ ctx[7]);
    		},
    		m(target, anchor, remount) {
    			insert(target, span, anchor);
    			html_tag.m(span);
    			append(span, t);
    			if (remount) dispose();
    			dispose = listen(span, "click", /*click*/ ctx[8]);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*renderlistitem, dataList*/ 68 && raw_value !== (raw_value = /*renderListItemContent*/ ctx[11](/*renderlistitem*/ ctx[2], /*item*/ ctx[30]) + "")) html_tag.p(raw_value);

    			if (dirty[0] & /*index*/ 128) {
    				toggle_class(span, "is--highlighted", /*i*/ ctx[32] === /*index*/ ctx[7]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    			dispose();
    		}
    	};
    }

    function create_fragment(ctx) {
    	let input0;
    	let t0;
    	let input1;
    	let t1;
    	let span;
    	let dispose;
    	let each_value = /*dataList*/ ctx[6];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			input0 = element("input");
    			t0 = space();
    			input1 = element("input");
    			t1 = space();
    			span = element("span");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.c = noop;
    			attr(input0, "placeholder", /*placeholder*/ ctx[3]);
    			attr(input0, "name", "autocompleter__input");
    			attr(input0, "type", "text");
    			attr(input1, "type", "hidden");
    			attr(input1, "name", /*name*/ ctx[4]);
    			attr(input1, "output", /*output*/ ctx[0]);
    			attr(span, "class", "list");
    			toggle_class(span, "is--hidden", /*dataList*/ ctx[6].length === 0);
    		},
    		m(target, anchor, remount) {
    			insert(target, input0, anchor);
    			set_input_value(input0, /*show*/ ctx[1]);
    			insert(target, t0, anchor);
    			insert(target, input1, anchor);
    			insert(target, t1, anchor);
    			insert(target, span, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(span, null);
    			}

    			/*span_binding*/ ctx[29](span);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen(input0, "keydown", /*handleKeydown*/ ctx[10]),
    				listen(input0, "keyup", /*handleKeyup*/ ctx[9]),
    				listen(input0, "input", /*input0_input_handler*/ ctx[28])
    			];
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*placeholder*/ 8) {
    				attr(input0, "placeholder", /*placeholder*/ ctx[3]);
    			}

    			if (dirty[0] & /*show*/ 2 && input0.value !== /*show*/ ctx[1]) {
    				set_input_value(input0, /*show*/ ctx[1]);
    			}

    			if (dirty[0] & /*name*/ 16) {
    				attr(input1, "name", /*name*/ ctx[4]);
    			}

    			if (dirty[0] & /*output*/ 1) {
    				attr(input1, "output", /*output*/ ctx[0]);
    			}

    			if (dirty[0] & /*index, click, renderListItemContent, renderlistitem, dataList*/ 2500) {
    				each_value = /*dataList*/ ctx[6];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(span, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty[0] & /*dataList*/ 64) {
    				toggle_class(span, "is--hidden", /*dataList*/ ctx[6].length === 0);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(input0);
    			if (detaching) detach(t0);
    			if (detaching) detach(input1);
    			if (detaching) detach(t1);
    			if (detaching) detach(span);
    			destroy_each(each_blocks, detaching);
    			/*span_binding*/ ctx[29](null);
    			run_all(dispose);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { renderlistitem = item => item } = $$props;
    	let { onkeyupfilter = item => item.includes(show) } = $$props;

    	let { onselected = item => {
    		return { "show": item, "output": item };
    	} } = $$props;

    	let { placeholder = "Enter some key words ..." } = $$props;
    	let { datasource = null } = $$props;
    	let { output = null } = $$props;
    	let { show = null } = $$props;
    	let { name = null } = $$props;
    	let listElement = null;
    	let dataList = [];
    	let index = 0;
    	let host = get_current_component();

    	const dataSourceIsRequest = () => {
    		if (typeof datasource === "function") {
    			const source = datasource(show);
    			return source instanceof Request;
    		}
    	};

    	const dataSourceIsArray = () => {
    		if (typeof datasource === "function") {
    			const source = datasource();
    			return Array.isArray(source);
    		}
    	};

    	const select = () => {
    		try {
    			if (!typeof onSelect === "function") {
    				throw "onselected have to be a function";
    			}

    			const selected = onselected(dataList[index]);

    			if (!selected.show || !selected.output) {
    				throw "onselected have to return {show, output}";
    			}

    			$$invalidate(1, show = selected.show);
    			$$invalidate(0, output = selected.output);
    			reset();
    			host.dispatchEvent(new CustomEvent("AUTOCOMPLETER:SELECTED", { detail: { show, output } }));
    		} catch(e) {
    			console.error(e);
    		}
    	};

    	const click = event => {
    		const target = event.target;
    		const elements = listElement.childNodes;
    		$$invalidate(7, index = Array.prototype.indexOf.call(elements, target));
    		return select();
    	};

    	const reset = () => {
    		$$invalidate(6, dataList = []);
    		$$invalidate(7, index = 0);
    	};

    	const clear = () => {
    		if (show !== "") {
    			$$invalidate(1, show = "");
    			reset();
    			$$invalidate(0, output = "");
    			host.dispatchEvent(new CustomEvent("AUTOCOMPLETER:CLEARED"));
    		} else {
    			reset();
    		}
    	};

    	const keyup = () => {
    		if (dataSourceIsRequest()) {
    			$$invalidate(6, dataList = []);

    			fetch(datasource(show)).then(response => response.json()).then(json => {
    				if (!json || !Array.isArray(json)) {
    					json = [];
    				}

    				if (typeof onkeyupfilter === "function") {
    					$$invalidate(6, dataList = json.filter(item => onkeyupfilter(item, show)));
    				} else {
    					$$invalidate(6, dataList = json);
    				}
    			}).catch(error => console.log(error));
    		} else if (dataSourceIsArray()) {
    			if (dataList.length === 0) {
    				$$invalidate(6, dataList = datasource());
    			}

    			if (typeof onkeyupfilter === "function") {
    				$$invalidate(6, dataList = dataList.filter(item => onkeyupfilter(item, show)));
    			}
    		}
    	};

    	const handleKeyup = event => {
    		const key = event.key;

    		if (!["Enter", "Escape", "ArrowDown", "ArrowUp"].includes(key)) {
    			if (show) {
    				keyup();
    			} else {
    				clear();
    			}
    		}
    	};

    	const handleKeydown = event => {
    		const key = event.key;

    		if (!show || ["Alt", "Meta", "Control"].includes(key)) {
    			return;
    		}

    		if (key === "Enter") {
    			select();
    		} else if (key === "Escape") {
    			clear();
    		} else if (key === "ArrowDown") {
    			next();
    		} else if (key === "ArrowUp") {
    			previous();
    		}
    	};

    	// List navigation
    	const next = () => {
    		const lastIndex = listElement.childNodes.length - 1;

    		if (index + 1 <= lastIndex) {
    			$$invalidate(7, index++, index);
    			$$invalidate(5, listElement.scrollTop = scrollToNext(index), listElement);
    		} else {
    			$$invalidate(7, index = 0);
    			$$invalidate(5, listElement.scrollTop = 0, listElement);
    		}

    		return index;
    	};

    	const previous = () => {
    		if (index - 1 >= 0) {
    			$$invalidate(7, index--, index);
    			$$invalidate(5, listElement.scrollTop = scrollToPrevious(index), listElement);
    		} else {
    			$$invalidate(7, index = listElement.childNodes.length - 1);
    			$$invalidate(5, listElement.scrollTop = scrollToLastLast(), listElement);
    		}

    		return index;
    	};

    	const scrollTo = (index, direction) => {
    		const element = listElement.childNodes.item(index);
    		const { height } = element.getBoundingClientRect();

    		if (direction === "next") {
    			return listElement.scrollTop + height;
    		} else if (direction = "previous") {
    			return listElement.scrollTop - height;
    		}
    	};

    	const scrollToLastLast = () => {
    		let h = 0;

    		listElement.childNodes.forEach((child, i) => {
    			if (i <= listElement.childNodes.length - 2) {
    				const { height } = child.getBoundingClientRect();
    				h += height;
    			}
    		});

    		return h;
    	};

    	const scrollToNext = index => {
    		return scrollTo(index, "next");
    	};

    	const scrollToPrevious = index => {
    		return scrollTo(index, "previous");
    	};

    	// List item
    	const renderListItemContent = (template, data) => {
    		if (!template && typeof data === "string") {
    			return data;
    		} else if (typeof template === "function") {
    			return template(data);
    		}
    	};

    	function input0_input_handler() {
    		show = this.value;
    		$$invalidate(1, show);
    	}

    	function span_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(5, listElement = $$value);
    		});
    	}

    	$$self.$set = $$props => {
    		if ("renderlistitem" in $$props) $$invalidate(2, renderlistitem = $$props.renderlistitem);
    		if ("onkeyupfilter" in $$props) $$invalidate(12, onkeyupfilter = $$props.onkeyupfilter);
    		if ("onselected" in $$props) $$invalidate(13, onselected = $$props.onselected);
    		if ("placeholder" in $$props) $$invalidate(3, placeholder = $$props.placeholder);
    		if ("datasource" in $$props) $$invalidate(14, datasource = $$props.datasource);
    		if ("output" in $$props) $$invalidate(0, output = $$props.output);
    		if ("show" in $$props) $$invalidate(1, show = $$props.show);
    		if ("name" in $$props) $$invalidate(4, name = $$props.name);
    	};

    	return [
    		output,
    		show,
    		renderlistitem,
    		placeholder,
    		name,
    		listElement,
    		dataList,
    		index,
    		click,
    		handleKeyup,
    		handleKeydown,
    		renderListItemContent,
    		onkeyupfilter,
    		onselected,
    		datasource,
    		host,
    		dataSourceIsRequest,
    		dataSourceIsArray,
    		select,
    		reset,
    		clear,
    		keyup,
    		next,
    		previous,
    		scrollTo,
    		scrollToLastLast,
    		scrollToNext,
    		scrollToPrevious,
    		input0_input_handler,
    		span_binding
    	];
    }

    class Autocompleter extends SvelteElement {
    	constructor(options) {
    		super();

    		this.shadowRoot.innerHTML = `<style>:host{all:initial;display:block;position:relative;box-sizing:border-box}:host(.inline){display:inline-block}:host>input{box-sizing:border-box;display:block;width:100%;max-width:100%;margin:0;padding:5px;border-width:var(--input-border-width, 1px);border-style:var(--input-border-style, solid);border-color:var(--input-border-color, #cccccc);border-radius:var(--input-border-radius, 0 0 0 0);background:var(--input-background, white);color:inherit;font:inherit;outline:none}:host>input::placeholder{font:var(--input-placeholder-font, inherit);color:var(--input-placeholder-color, inherit)}.list,.list-item{box-sizing:border-box;display:block}:host>.list{position:absolute;top:calc(100% - 1px);width:100%;max-width:100%;border-width:var(--list-border-width, 1px);border-style:var(--list-border-style, solid);border-color:var(--list-border-color, #cccccc);border-radius:var(--list-border-radius, 0 0 0 0);max-height:var(--list-max-height, 250px);overflow-y:scroll;box-shadow:0 1px 5px hsla(1, 0%, 0%, 0.05),
      0 3px 7px hsla(1, 0%, 0%, 0.05),
      0 5px 9px hsla(1, 0%, 0%, 0.05),
      0 7px 11px hsla(1, 0%, 0%, 0.05)}:host .list-item{padding:var(--listitem-padding, 5px);background-color:var(--listitem-background-color, white);font:var(--listitem-font, inherit);color:var(--listitem-color, inherit);width:100%;cursor:pointer}:host .list-item+.list-item{border-width:var(--listitem-border-width, 1px 0 0 0);border-style:var(--listitem-border-style, solid);border-color:var(--listitem-border-color, #cccccc)}.list.is--hidden{visibility:hidden}:host .list-item.is--highlighted{background-color:var(--listitem-highlighted-background-color, #eeeeee);font:var(--listitem-highlighted-font, inherit)}</style>`;

    		init(
    			this,
    			{ target: this.shadowRoot },
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{
    				renderlistitem: 2,
    				onkeyupfilter: 12,
    				onselected: 13,
    				placeholder: 3,
    				datasource: 14,
    				output: 0,
    				show: 1,
    				name: 4
    			},
    			[-1, -1]
    		);

    		if (options) {
    			if (options.target) {
    				insert(options.target, this, options.anchor);
    			}

    			if (options.props) {
    				this.$set(options.props);
    				flush();
    			}
    		}
    	}

    	static get observedAttributes() {
    		return [
    			"renderlistitem",
    			"onkeyupfilter",
    			"onselected",
    			"placeholder",
    			"datasource",
    			"output",
    			"show",
    			"name"
    		];
    	}

    	get renderlistitem() {
    		return this.$$.ctx[2];
    	}

    	set renderlistitem(renderlistitem) {
    		this.$set({ renderlistitem });
    		flush();
    	}

    	get onkeyupfilter() {
    		return this.$$.ctx[12];
    	}

    	set onkeyupfilter(onkeyupfilter) {
    		this.$set({ onkeyupfilter });
    		flush();
    	}

    	get onselected() {
    		return this.$$.ctx[13];
    	}

    	set onselected(onselected) {
    		this.$set({ onselected });
    		flush();
    	}

    	get placeholder() {
    		return this.$$.ctx[3];
    	}

    	set placeholder(placeholder) {
    		this.$set({ placeholder });
    		flush();
    	}

    	get datasource() {
    		return this.$$.ctx[14];
    	}

    	set datasource(datasource) {
    		this.$set({ datasource });
    		flush();
    	}

    	get output() {
    		return this.$$.ctx[0];
    	}

    	set output(output) {
    		this.$set({ output });
    		flush();
    	}

    	get show() {
    		return this.$$.ctx[1];
    	}

    	set show(show) {
    		this.$set({ show });
    		flush();
    	}

    	get name() {
    		return this.$$.ctx[4];
    	}

    	set name(name) {
    		this.$set({ name });
    		flush();
    	}
    }

    customElements.define("svelte-autocompleter", Autocompleter);

    return Autocompleter;

})));
