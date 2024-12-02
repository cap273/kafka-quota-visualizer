<!-- src/components/BrokerVisualization.vue -->
<template>
  <v-card class="mb-4">
    <v-card-title>Broker {{ broker.id }}</v-card-title>
    <v-card-text>
      <!-- Section 1: Throughput from other topics -->
      <v-divider></v-divider>
      <div class="mt-1 subtitle">
        Throughput from other topics
      </div>
      <div class="mt-2">
        <div>
          <strong>Background Throughput:</strong>
          {{ backgroundThroughputPerBroker.toFixed(2) }} MB/s
        </div>
      </div>

      <!-- Section 2: Kafka throttling -->
      <v-divider class="mt-4"></v-divider>
      <div class="mt-1 subtitle">
        Kafka throttling
      </div>
      <div class="mt-2">
        <div>
          <strong>Additional Requested Produce Throughput:</strong>
          {{ additionalRequestedProduceThroughput.toFixed(2) }} MB/s
        </div>
        <div
          class="mt-1 throttled-throughput"
          :class="{
            'throttled-active': throttledThroughput > 0,
            'throttled-inactive': throttledThroughput === 0
          }"
        >
          <strong>Throttled Throughput:</strong>
          {{ throttledThroughput.toFixed(2) }} MB/s
        </div>
      </div>

      <!-- Section 3: Broker limits -->
      <v-divider class="mt-4"></v-divider>
      <div class="mt-1 subtitle">
        Broker limits
      </div>
      <div class="mt-2">
        <div
          :class="{
            'exceeds-throughput': totalAttemptedThroughput > maxBrokerThroughput
          }"
        >
          <strong>Total Attempted Throughput (after throttling):</strong>
          {{ totalAttemptedThroughput.toFixed(2) }} MB/s
          <span v-if="totalAttemptedThroughput > maxBrokerThroughput" class="exceed-text">
            (Exceeds by {{ (totalAttemptedThroughput - maxBrokerThroughput).toFixed(2) }} MB/s)
          </span>
        </div>
        <div
          class="mt-1 total-effective-throughput"
          :class="{
            'headroom': totalEffectiveThroughput < maxBrokerThroughput
          }"
        >
          <strong>Total Effective Throughput:</strong>
          {{ totalEffectiveThroughput.toFixed(2) }} MB/s
          <span v-if="totalEffectiveThroughput < maxBrokerThroughput" class="headroom-text">
            (Headroom: {{ (maxBrokerThroughput - totalEffectiveThroughput).toFixed(2) }} MB/s)
          </span>
        </div>
      </div>

      <!-- Partitions Visualization -->
      <div class="mt-4">
        <draggable
          :list="partitions"
          @change="onPartitionsChange"
          :group="partitionGroup"
          item-key="partitionKey"
          tag="div"
          class="d-flex flex-wrap"
        >
          <template #item="{ element }">
            <div class="p-2">
              <PartitionVisualization
                :partition="element"
                :produce-rate-per-partition="produceRatePerPartition(element)"
                :throttled-throughput="throttledThroughputPerPartition(element)"
                :throttling-type="throttlingType"
              />
            </div>
          </template>
        </draggable>
      </div>
    </v-card-text>
  </v-card>
</template>

<script>
import { defineComponent, computed } from 'vue';
import draggable from 'vuedraggable';
import PartitionVisualization from './PartitionVisualization.vue';

export default defineComponent({
  name: 'BrokerVisualization',
  components: {
    draggable,
    PartitionVisualization,
  },
  props: {
    broker: {
      type: Object,
      required: true,
    },
    partitions: {
      type: Array,
      required: true,
    },
    configuration: {
      type: Object,
      required: true,
    },
    partitionGroup: {
      type: String,
      required: true,
    },
  },
  emits: ['partitions-changed'],
  setup(props, { emit }) {
    // Computed property for Background Throughput per Broker
    const backgroundThroughputPerBroker = computed(() => {
      const backgroundThroughput = Number(props.configuration.backgroundThroughput) || 0;
      const numBrokers = Number(props.configuration.numBrokers) || 1;
      return backgroundThroughput / numBrokers;
    });

    // Function to calculate Produce Rate per Partition
    const produceRatePerPartition = (partition) => {
      const topic = props.configuration.topics.find(
        (t) => t.topicName === partition.topicName
      );
      if (topic) {
        const produceRate = Number(topic.produceRate) || 0;
        const numPartitions = Number(topic.numPartitions) || 1;
        return produceRate / numPartitions;
      }
      return 0;
    };

    // Computed property for Throttling Type
    const throttlingType = computed(() => props.configuration.throttlingType);

    // Computed property for Quota Value
    const quotaValue = computed(() => Number(props.configuration.quotaValue) || 0);

    // Computed property for Additional Requested Produce Throughput
    const additionalRequestedProduceThroughput = computed(() => {
      return props.partitions.reduce((sum, partition) => {
        return sum + produceRatePerPartition(partition);
      }, 0);
    });

    // Function to calculate Throttled Throughput per Partition
    const throttledThroughputPerPartition = (partition) => {
      if (throttlingType.value === 'Per Partition') {
        const produceRate = produceRatePerPartition(partition);
        const difference = quotaValue.value - produceRate;
        return difference > 0 ? 0 : Math.abs(difference);
      } else {
        return 0;
      }
    };

    // Computed property for Throttled Throughput
    const throttledThroughput = computed(() => {
      if (throttlingType.value === 'Per Client Per Broker') {
        const difference = additionalRequestedProduceThroughput.value - quotaValue.value;
        return difference > 0 ? difference : 0;
      } else {
        // For "Per Partition", sum of throttling applied at each partition hosted by the broker
        return props.partitions.reduce((sum, partition) => {
          return sum + throttledThroughputPerPartition(partition);
        }, 0);
      }
    });

    // Computed property for Total Attempted Throughput
    const totalAttemptedThroughput = computed(() => {
      return (
        backgroundThroughputPerBroker.value +
        additionalRequestedProduceThroughput.value -
        throttledThroughput.value
      );
    });

    // Computed property for Total Effective Throughput
    const totalEffectiveThroughput = computed(() => {
      return Math.min(totalAttemptedThroughput.value, props.configuration.maxBrokerThroughput);
    });

    // Max Broker Throughput
    const maxBrokerThroughput = computed(() => Number(props.configuration.maxBrokerThroughput) || 0);

    // Handler for Partition Changes
    const onPartitionsChange = (event) => {
      emit('partitions-changed', {
        brokerId: props.broker.id,
        event,
      });
    };

    return {
      backgroundThroughputPerBroker,
      produceRatePerPartition,
      throttlingType,
      quotaValue,
      additionalRequestedProduceThroughput,
      throttledThroughput,
      totalAttemptedThroughput,
      totalEffectiveThroughput,
      throttledThroughputPerPartition,
      maxBrokerThroughput,
      onPartitionsChange,
    };
  },
});
</script>

<style scoped>
.d-flex {
  display: flex;
}

.flex-wrap {
  flex-wrap: wrap;
}

.p-2 {
  padding: 8px;
}

/* Styling for section subtitles */
.subtitle {
  font-size: 0.75rem; /* Equivalent to caption */
  font-weight: 500;    /* Medium font weight */
}

/* Spacing between sections */
.mt-1 {
  margin-top: 0.25rem;
}

.mt-2 {
  margin-top: 0.5rem;
}

.mt-4 {
  margin-top: 1.5rem;
}

.throttled-active {
  color: orange;
}

.throttled-inactive {
  color: green;
}

/* Conditional styling for Total Attempted Throughput exceeding Max Broker Throughput */
.exceeds-throughput {
  color: red;
}

.exceed-text {
  font-size: 0.75rem;
  color: red;
  margin-left: 0.5rem;
}

/* Conditional styling for Total Effective Throughput headroom */
.headroom-text {
  font-size: 0.75rem;
  color: green;
  margin-left: 0.5rem;
}

.headroom {
  color: green;
}
</style>
