<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<!-- The main wrapper for the app. It's fully transparent to allow the OS blur to show through -->
<div class="h-screen w-screen overflow-hidden bg-transparent text-white antialiased">
  {@render children()}
</div>
