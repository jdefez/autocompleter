<svelte:options tag="svelte-autocompleter-list-item"/>
<script>
  import { afterUpdate } from 'svelte';
  export let data = null;
  export let template = null;
  export let highlighted = false;
  export let me = null;

  const render = (template, data) => {
    if (!template && typeof data === 'string') {
      return data;
    } else if (typeof template === 'function') {
      return template(data);
    }
  };

  const renderInner = (template, data) => {
    me.innerHTML = render(template, data);
  };
  afterUpdate(() => renderInner(template, data));
</script>
<span class="autocompleter__list_item"
  bind:this={me}
  class:is--highlighted={highlighted}></span>
<style type="text/css">
  .autocompleter__list_item {
    box-sizing: border-box;
    display: block;
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
