<svelte:options tag="svelte-autocompleter"/>

<script>
  import { listitem } from './listitem.js';
  import AutocompleterListItem from './AutocompleterListItem.svelte';
  import { onMount } from 'svelte';

  export let renderlistitem = (item) => item;
  export let onkeyupfilter = (item, show) => item.includes(show);
  export let onselected = (item) => { return {'show': item, 'output': item}; };
  export let oncleared = null;

  export let placeholder = 'Enter some key words ...';
  export let datasource = null;
  export let output = null;
  export let show = null;
  export let name = null;

  let dataList = [];
  let index = 0;
  let me;

  let listElement = null;
  onMount(() => {
    listElement = me.querySelector('.autocompleter__list');
  });

  const dataSourceIsRequest = () => {
    if (typeof datasource === 'function') {
      try {
        const source = datasource(show);
        if (!source instanceof Request) {
          throw '@param datasource has to be a Request object';
        }
        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    }
  };

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

    } catch (e) {
      console.error(e);
    }
  };

  const click = (event) => {
    const target = event.target;
    const elements = listElement.childNodes;
    index = Array.prototype.indexOf.call(elements, target);
    dispatch('autocompleterSelect');
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
    } else {
      if (dataList && !dataList.length) {
        dataList = datasource;
      }
      if (dataList && dataList.length && typeof onkeyupfilter === 'function') {
        dataList = dataList.filter((item) => onkeyupfilter(item, show));
      }
    }
  };

  const reset = () => {
    dataList = [];
    index = 0;
  }

  const clear = () => {
    if (show !== '') {
      show = '';
      reset();
      output = '';
      if (typeof oncleared === 'function') {
        oncleared();
      }
    }
  }

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

  // list navigation
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

  // list item
  const renderListItemContent = (template, data) => {
    if (!template && typeof data === 'string') {
      return data;
    } else if (typeof template === 'function') {
      return template(data);
    }
  };
</script>
<span class="autocompleter"
  bind:this={me}>
  <input placeholder={placeholder}
    on:keydown={handleKeydown}
    on:keyup={handleKeyup}
    bind:value={show}
    class="autocompleter__input"
    name="autocompleter__input"
    type="text">
  <input type="hidden"
    name={name}
    output={output}>
  <span class="autocompleter__list"
    class:is--hidden={dataList.length === 0}>
    {#each dataList as item, i }
    <span class="autocompleter__list_item"
      use:listitem={renderListItemContent(renderlistitem, item)}
      class:is--highlighted={i === index}
      on:click={click}>{ i }</span>
    {/each}
  </span>
</span>
<style type="text/css">
  /* todo: check about using :host in here */
  .autocompleter {
    position: relative;
    box-sizing: border-box;
    display: block;
  }
  .autocompleter__input {
    box-sizing: border-box;
    display: block;
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: 5px;
  }
  .autocompleter__list,
  .autocompleter__list_item {
    box-sizing: border-box;
    display: block;
  }
  .autocompleter__list {
    position: absolute;
    top: 100%;
    width: 100%;
    max-width: 100%;
    border: 1px solid #ccc;
    background-color: white;
    max-height: 250px;
    overflow-y: scroll;
  }
  .autocompleter__list.is--hidden {
    visibility: hidden;
  }
  .autocompleter__list_item {
    padding: 5px;
    width: 100%;
  }
  .autocompleter__list_item + .autocompleter__list_item {
    border-top: 1px solid #ccc;
  }
  .autocompleter__list_item.is--highlighted {
    background-color: #eee;
  }
</style>
