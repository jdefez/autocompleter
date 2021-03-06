<svelte:options tag="svelte-autocompleter"/>
<script>
  import { get_current_component } from 'svelte/internal';

  export let renderlistitem = (item) => item;
  export let onkeyupfilter = (item) => item.includes(show);
  export let onselected = (item) => { return {'show': item, 'output': item}; };

  export let placeholder = 'Enter some key words ...';
  export let datasource = null;
  export let output = null;
  export let show = null;
  export let name = null;

  let listElement = null;
  let dataList = [];
  let index = 0;
  let host = get_current_component();

  const dataSourceIsRequest = () => {
    if (typeof datasource === 'function') {
      const source = datasource(show);
      return source instanceof Request;
    }
  };

  const dataSourceIsArray = () => {
    if (typeof datasource === 'function') {
      const source = datasource();
      return Array.isArray(source);
    }
  }

  const select = () => {
    try {
      if (!typeof onSelect === 'function') {
        throw 'onselected have to be a function';
      }

      const selected = onselected(dataList[index]);
      if (!selected.show || !selected.output) {
        throw 'onselected have to return {show, output}';
      }

      show = selected.show;
      output = selected.output;
      reset();

      host.dispatchEvent(new CustomEvent(
        'AUTOCOMPLETER:SELECTED',
        {detail: {show, output}}
      ));

    } catch (e) {
      console.error(e);
    }
  };

  const click = (event) => {
    const target = event.target;
    const elements = listElement.childNodes;
    index = Array.prototype.indexOf.call(elements, target);
    return select();
  }

  const reset = () => {
    dataList = [];
    index = 0;
  }

  const clear = () => {
    if (show !== '') {
      show = '';
      reset();
      output = '';

      host.dispatchEvent(new CustomEvent('AUTOCOMPLETER:CLEARED'));
    } else {
      reset();
    }
  }

  const keyup = () => {
    if (dataSourceIsRequest()) {
      dataList = [];
      fetch(datasource(show))
        .then((response) => response.json())
        .then((json) => {
          if (!json || !Array.isArray(json)) {
            json = [];
          }
          if (typeof onkeyupfilter === 'function') {
            dataList = json.filter((item) => onkeyupfilter(item, show));
          } else {
            dataList = json;
          }
        })
        .catch((error) => console.log(error));

    } else if (dataSourceIsArray()) {
      if (dataList.length === 0) {
        dataList = datasource();
      }
      if (typeof onkeyupfilter === 'function') {
        dataList = dataList.filter((item) => onkeyupfilter(item, show));
      }
    }
  };

  const handleKeyup = (event) => {
    const key = event.key;
    if (!['Enter', 'Escape', 'ArrowDown', 'ArrowUp'].includes(key)) {
      if (show) {
        keyup();
      } else {
        clear();
      }
    }
  }

  const handleKeydown = (event) => {
    const key = event.key;
    if (!show || ['Alt', 'Meta', 'Control'].includes(key)) {
      return;
    }

    if (key === 'Enter') {
      select();
    } else if (key === 'Escape') {
      clear();
    } else if (key === 'ArrowDown') {
      next();
    } else if (key === 'ArrowUp') {
      previous();
    }
  }

  // List navigation
  const next = () => {
    const lastIndex = listElement.childNodes.length - 1;
    if (index + 1 <= lastIndex) {
      index++;
      listElement.scrollTop = scrollToNext(index);
    } else {
      index = 0;
      listElement.scrollTop = 0;
    }
    return index;
  };

  const previous = () => {
    if (index - 1 >= 0) {
      index--;
      listElement.scrollTop = scrollToPrevious(index);
    } else {
      index = listElement.childNodes.length - 1;
      listElement.scrollTop = scrollToLastLast();
    }
    return index;
  };

  const scrollTo = (index, direction) => {
    const element = listElement.childNodes.item(index);
    const {height} = element.getBoundingClientRect();
    if (direction === 'next') {
      return listElement.scrollTop + height;
    } else if (direction = 'previous') {
      return listElement.scrollTop - height;
    }
  }

  const scrollToLastLast = () => {
    let h = 0;
    listElement.childNodes.forEach((child, i) => {
      if (i <= listElement.childNodes.length - 2) {
        const {height} = child.getBoundingClientRect();
        h += height;
      }
    });
    return h;
  }

  const scrollToNext = (index) => {
    return scrollTo(index, 'next');
  }

  const scrollToPrevious = (index) => {
    return scrollTo(index, 'previous');
  }

  // List item
  const renderListItemContent = (template, data) => {
    if (!template && typeof data === 'string') {
      return data;
    } else if (typeof template === 'function') {
      return template(data);
    }
  };
</script>
<input placeholder={placeholder}
  on:keydown={handleKeydown}
  on:keyup={handleKeyup}
  bind:value={show}
  name="autocompleter__input"
  type="text">
<input type="hidden"
  name={name}
  output={output}>
<span class="list"
  bind:this={listElement}
  class:is--hidden={dataList.length === 0}>
  {#each dataList as item, i }
  <span class="list-item"
    class:is--highlighted={i === index}
    on:click={click}>
    {@html renderListItemContent(renderlistitem, item)}
  </span>
  {/each}
</span>
<style type="text/css">
  :host {
    all: initial;
    display: block;
    position: relative;
    box-sizing: border-box;
  }
  :host(.inline) { display: inline-block; }
  :host > input {
    box-sizing: border-box;
    display: block;
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: 5px;
    border-width: var(--input-border-width, 1px);
    border-style: var(--input-border-style, solid);
    border-color: var(--input-border-color, #cccccc);
    border-radius: var(--input-border-radius, 0 0 0 0);
    background: var(--input-background, white);
    color: inherit;
    font: inherit;
    outline: none;
  }
  :host >input::placeholder {
    font: var(--input-placeholder-font, inherit);
    color: var(--input-placeholder-color, inherit);
  }
  .list,
  .list-item {
    box-sizing: border-box;
    display: block;
  }
  :host > .list {
    position: absolute;
    top: calc(100% - 1px);
    width: 100%;
    max-width: 100%;
    border-width: var(--list-border-width, 1px);
    border-style: var(--list-border-style, solid);
    border-color: var(--list-border-color, #cccccc);
    border-radius: var(--list-border-radius, 0 0 0 0);
    max-height: var(--list-max-height, 250px);
    overflow-y: scroll;
    box-shadow: 0 1px 5px hsla(1, 0%, 0%, 0.05),
      0 3px 7px hsla(1, 0%, 0%, 0.05),
      0 5px 9px hsla(1, 0%, 0%, 0.05),
      0 7px 11px hsla(1, 0%, 0%, 0.05);
  }
  :host .list-item {
    padding: var(--listitem-padding, 5px);
    background-color: var(--listitem-background-color, white);
    font: var(--listitem-font, inherit);
    color: var(--listitem-color, inherit);
    width: 100%;
    cursor: pointer;
  }
  :host .list-item + .list-item {
    border-width: var(--listitem-border-width, 1px 0 0 0);
    border-style: var(--listitem-border-style, solid);
    border-color: var(--listitem-border-color, #cccccc);
  }
  .list.is--hidden { visibility: hidden; }
  :host .list-item.is--highlighted {
    background-color: var(--listitem-highlighted-background-color, #eeeeee);
    font: var(--listitem-highlighted-font, inherit);
  }
</style>
