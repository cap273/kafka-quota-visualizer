<!-- src/components/VisualizationArea.vue -->
<template>
  <div>
    <v-row>
      <v-col
        v-for="broker in brokers"
        :key="broker.id"
        cols="12"
        md="6"
      >
        <BrokerVisualization
          :broker="broker"
          :partitions="partitionsByBroker[broker.id]"
          :configuration="configuration"
          :partition-group="partitionGroup"
          @partitions-changed="onPartitionsChanged"
        />
      </v-col>
    </v-row>
  </div>
</template>

<script>
import { defineComponent, reactive, computed, watch, ref } from 'vue';
import BrokerVisualization from './BrokerVisualization.vue';

export default defineComponent({
  name: 'VisualizationArea',
  components: {
    BrokerVisualization,
  },
  props: {
    configuration: {
      type: Object,
      required: true,
    },
  },
  emits: ['update-configuration'],
  setup(props, { emit }) {
    const partitionsByBroker = reactive({});
    const partitionGroup = 'partitions';

    const brokers = computed(() => {
      return Array.from({ length: props.configuration.numBrokers }, (v, k) => ({
        id: k,
      }));
    });

    const isUserUpdating = ref(false); // Flag to prevent recursive updates

    const initializePartitionsByBroker = () => {
      console.log('Initializing partitions by broker...');
      // Initialize partitionsByBroker with all brokers
      brokers.value.forEach((broker) => {
        if (!partitionsByBroker[broker.id]) {
          partitionsByBroker[broker.id] = [];
        } else {
          // Clear existing partitions
          partitionsByBroker[broker.id].splice(0, partitionsByBroker[broker.id].length);
        }
      });

      // Assign partitions based on partitionsDistribution
      props.configuration.topics.forEach((topic) => {
        topic.partitionsDistribution.forEach((partition) => {
          const brokerId = partition.brokerId;
          if (partitionsByBroker[brokerId]) {
            partitionsByBroker[brokerId].push(partition);
          }
        });
      });

      console.log('Partitions by broker after initialization:', JSON.parse(JSON.stringify(partitionsByBroker)));
    };

    // Initialize partitionsByBroker when the component is created
    initializePartitionsByBroker();

    // Watch for changes in configuration to re-initialize partitionsByBroker
    watch(
      () => [
        props.configuration.numBrokers,
        ...props.configuration.topics.map((topic) => [
          topic.topicName,
          topic.numPartitions,
          topic.produceRate,
          ...topic.partitionsDistribution.map(p => p.partitionKey), // Simplify dependencies
        ]),
      ],
      () => {
        if (!isUserUpdating.value) {
          initializePartitionsByBroker();
        }
      },
      { deep: true }
    );

    const onPartitionsChanged = ({ brokerId, event }) => {
      console.log(`Partitions changed for broker ${brokerId}:`, event);
      isUserUpdating.value = true;

      // Handle added partitions
      if (event.added) {
        const partition = event.added.element;
        // Remove partition from all other brokers
        for (let otherBrokerId in partitionsByBroker) {
          if (Number(otherBrokerId) !== brokerId) {
            const index = partitionsByBroker[otherBrokerId].findIndex(
              (p) => p.partitionKey === partition.partitionKey
            );
            if (index !== -1) {
              partitionsByBroker[otherBrokerId].splice(index, 1);
            }
          }
        }
        // Ensure partition is in the current broker's list
        const currentPartitions = partitionsByBroker[brokerId];
        if (
          !currentPartitions.find(
            (p) => p.partitionKey === partition.partitionKey
          )
        ) {
          currentPartitions.splice(event.added.newIndex, 0, partition);
        }
      }

      // Handle removed partitions
      if (event.removed) {
        const partition = event.removed.element;
        const currentPartitions = partitionsByBroker[brokerId];
        const index = currentPartitions.findIndex(
          (p) => p.partitionKey === partition.partitionKey
        );
        if (index !== -1) {
          currentPartitions.splice(index, 1);
        }
      }

      // Update the configuration's partitionsDistribution
      updatePartitionsDistribution();

      isUserUpdating.value = false;
    };

    const updatePartitionsDistribution = () => {
      const newPartitionsDistribution = [];
      for (let brokerId in partitionsByBroker) {
        for (let partition of partitionsByBroker[brokerId]) {
          newPartitionsDistribution.push({
            ...partition,
            brokerId: parseInt(brokerId),
          });
        }
      }
      // Emit the updated configuration
      emit('update-configuration', {
        partitionsDistribution: newPartitionsDistribution,
      });
    };

    return {
      partitionsByBroker,
      brokers,
      partitionGroup,
      onPartitionsChanged,
    };
  },
});
</script>

<style scoped>
/* Add any component-specific styles here */
</style>
