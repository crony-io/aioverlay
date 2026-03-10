<div class="flex items-center gap-1.5 px-4 py-3">
  <span class="typing-dot h-2 w-2 rounded-full bg-indigo-400/70"></span>
  <span class="typing-dot h-2 w-2 rounded-full bg-indigo-400/70 delay-150"></span>
  <span class="typing-dot h-2 w-2 rounded-full bg-indigo-400/70 delay-300"></span>
</div>

<style>
  .typing-dot {
    animation: typingBounce 1.2s infinite ease-in-out;
  }

  .typing-dot.delay-150 {
    animation-delay: 0.15s;
  }

  .typing-dot.delay-300 {
    animation-delay: 0.3s;
  }

  @keyframes typingBounce {
    0%,
    60%,
    100% {
      opacity: 0.3;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-4px);
    }
  }
</style>
