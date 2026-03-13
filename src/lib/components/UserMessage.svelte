<script lang="ts">
  /** Regex to match inline base64 images: ![alt](data:mime;base64,DATA) */
  const BASE64_IMAGE_REGEX = /!\[[^\]]*\]\((data:[^;]+;base64,[^)]+)\)/g;

  let { content } = $props<{ content: string }>();

  interface MessagePart {
    type: 'text' | 'image';
    value: string;
  }

  /** Split message content into text and image parts for proper rendering */
  let parts = $derived.by(() => {
    const result: MessagePart[] = [];
    let lastIndex = 0;

    for (const match of content.matchAll(BASE64_IMAGE_REGEX)) {
      const textBefore = content.slice(lastIndex, match.index).trim();
      if (textBefore) {
        result.push({ type: 'text', value: textBefore });
      }
      result.push({ type: 'image', value: match[1] });
      lastIndex = (match.index ?? 0) + match[0].length;
    }

    const textAfter = content.slice(lastIndex).trim();
    if (textAfter) {
      result.push({ type: 'text', value: textAfter });
    }

    return result;
  });
</script>

{#each parts as part (part)}
  {#if part.type === 'image'}
    <img
      src={part.value}
      alt="Attached screenshot"
      class="max-w-full rounded-lg border border-white/10"
      style="max-height: 200px; object-fit: contain;"
    />
  {:else}
    <p class="whitespace-pre-wrap text-sm">{part.value}</p>
  {/if}
{/each}
