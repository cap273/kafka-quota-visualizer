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

    // Watch for changes in numBrokers and numPartitions to re-initialize partitionsByBroker
    watch(
      () => ({
        numBrokers: props.configuration.numBrokers,
        topics: props.configuration.topics.map(topic => ({
          topicName: topic.topicName,
          numPartitions: topic.numPartitions,
        })),
      }),
      (newValues, oldValues) => {
        console.log('VisualizationArea detected configuration changes:', newValues);
        if (!isUserUpdating.value) {
          const numBrokersChanged = newValues.numBrokers !== oldValues.numBrokers;
          const topicsChanged =
            newValues.topics.length !== oldValues.topics.length ||
            newValues.topics.some(
              (topic, index) =>
                topic.numPartitions !== (oldValues.topics[index]?.numPartitions || 0)
            );

          if (numBrokersChanged) {
            console.log('Number of brokers has changed.');
          }

          if (topicsChanged) {
            console.log('Number of partitions in one or more topics has changed.');
          }

          if (numBrokersChanged || topicsChanged) {
            initializePartitionsByBroker();
          } else {
            console.log('No relevant changes detected in VisualizationArea. Skipping initialization.');
          }
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
