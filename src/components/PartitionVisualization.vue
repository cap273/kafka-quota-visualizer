<!-- src/components/PartitionVisualization.vue -->
<template>
  <v-card class="pa-2" outlined>
    <v-card-title class="text-h7">
      Partition {{ partition.partitionId }} (Topic: {{ partition.topicName }})
    </v-card-title>
    <v-card-text>
      <div>
        <strong>Produce Rate:</strong>
        {{ formattedProduceRate }} MB/s
      </div>
      <!-- Conditionally render Throttled Throughput only if 'Per Partition' quota is selected -->
      <div
        v-if="throttlingType === 'Per Partition'"
        :class="{
          'throttled-active': throttledThroughput > 0,
          'throttled-inactive': throttledThroughput === 0
        }"
      >
        <strong>Throttled Throughput:</strong>
        {{ throttledThroughput.toFixed(2) }} MB/s
      </div>
    </v-card-text>
  </v-card>
</template>

<script>
import { defineComponent, computed } from 'vue';

export default defineComponent({
  name: 'PartitionVisualization',
  props: {
    partition: {
      type: Object,
      required: true,
    },
    produceRatePerPartition: {
      type: Number,
      required: true,
    },
    throttledThroughput: {
      type: Number,
      required: true,
    },
    throttlingType: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    // Format Produce Rate
    const formattedProduceRate = computed(() => {
      return isNaN(props.produceRatePerPartition)
        ? 'N/A'
        : props.produceRatePerPartition.toFixed(2);
    });

    // Format Throttled Throughput
    const formattedThrottledThroughput = computed(() => {
      return isNaN(props.throttledThroughput)
        ? 'N/A'
        : props.throttledThroughput.toFixed(2);
    });

    return {
      formattedProduceRate,
      formattedThrottledThroughput,
    };
  },
});
</script>

<style scoped>
.throttled-active {
  color: orange;
}

.throttled-inactive {
  color: green;
}
</style>
