<script lang="ts">
  interface Props {
    title: string;
    count: number;
  }

  let { title, count }: Props = $props();
</script>

<p>{title}: {count}</p>
