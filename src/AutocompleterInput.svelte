<script>
  import { createEventDispatcher } from 'svelte';

  export let placeholder = 'Enter some key words ...';
  export let output = '';
  export let name = 'autocompleter__output';
  export let show = '';

  const dispatch = createEventDispatcher();

  const clear = () => {
    if (show !== '') {
      show = '';
      dispatch('autocompleterClear');
    }
  }

  const keyup = (event) => {
    const key = event.key;
    if (!['Enter', 'Escape', 'ArrowDown', 'ArrowUp'].includes(key)) {
      if (show) {
        dispatch('autocompleterKeyup');
      } else {
        dispatch('autocompleterClear');
      }
    }
  }

  const keydown = (event) => {
    const key = event.key;
    if (key === 'Enter') {
      dispatch('autocompleterSelect');
    } else if (key === 'Escape') {
      clear();
    } else if (key === 'ArrowDown') {
      dispatch('autocompleterSelectNext');
    } else if (key === 'ArrowUp') {
      dispatch('autocompleterSelectPrevious');
    }
  }
</script>
<input placeholder={placeholder}
  on:keydown={keydown}
  on:keyup={keyup}
  bind:value={show}
  class="autocompleter__input"
  name="autocompleter__input"
  type="text">
<input type="hidden"
  name={name}
  output={output}>
<style type="text/css">
  .autocompleter__input {
    box-sizing: border-box;
    display: block;
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: 5px;
  }
</style>
