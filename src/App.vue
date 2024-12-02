<!-- src/App.vue -->
<template>
  <v-app>
    <v-row>
      <v-col cols="4">
        <SideBar
          @update-configuration="updateConfiguration"
          :configuration="configuration"
        />
      </v-col>
      <v-col cols="8">
        <VisualizationArea
          :configuration="configuration"
          @update-configuration="updateConfiguration"
        />
      </v-col>
    </v-row>
  </v-app>
</template>

<script>
import { reactive, watch, toRefs } from 'vue';
import SideBar from './components/SideBar.vue';
import VisualizationArea from './components/VisualizationArea.vue';

export default {
  name: 'App',
  components: {
    SideBar,
    VisualizationArea,
  },
  setup() {
    // Initialize configuration as a reactive object
    const configuration = reactive({
      topics: [
        {
          topicName: 'A',
          produceRate: 4, // MB/s
          numPartitions: 2,
          partitionsDistribution: [],
        },
      ],
      numBrokers: 2,
      maxBrokerThroughput: 8, // MB/s
      backgroundThroughput: 10, // MB/s for the entire cluster
      throttlingType: 'Per Client Per Broker',
      quotaValue: 2 // MB/s
    });

    let initializing = false; // Flag to prevent recursive updates

    // Helper function to get broker with the fewest partitions
    const getBrokerWithFewestPartitions = () => {
      const brokerPartitionCounts = {};
      for (let i = 0; i < configuration.numBrokers; i++) {
        brokerPartitionCounts[i] = 0;
      }
      configuration.topics.forEach((topic) => {
        topic.partitionsDistribution.forEach((partition) => {
          brokerPartitionCounts[partition.brokerId]++;
        });
      });
      // Find the broker with the minimum count
      let minBroker = 0;
      let minCount = brokerPartitionCounts[0];
      for (let i = 1; i < configuration.numBrokers; i++) {
        if (brokerPartitionCounts[i] < minCount) {
          minBroker = i;
          minCount = brokerPartitionCounts[i];
        }
      }
      return minBroker;
    };

    // Function to initialize partitions for all topics
    const initializePartitions = () => {
      if (initializing) return;
      initializing = true;
      configuration.topics.forEach((topic) => {
        // Reset partitionsDistribution
        topic.partitionsDistribution = [];
        for (let i = 0; i < topic.numPartitions; i++) {
          const brokerId = getBrokerWithFewestPartitions();
          topic.partitionsDistribution.push({
            topicName: topic.topicName,
            partitionId: i,
            brokerId: brokerId,
            partitionKey: `${topic.topicName}-${i}`, // Unique key
          });
        }
      });
      initializing = false;
    };

    // Function to rebalance all partitions across brokers
    const rebalancePartitions = () => {
      if (initializing) return;
      initializing = true;
      configuration.topics.forEach((topic) => {
        // Clear current distribution
        topic.partitionsDistribution = [];
        // Collect all partitions
        const partitions = Array.from({ length: topic.numPartitions }, (v, k) => k);
        // Sort brokers by current number of partitions for this topic
        const brokersSorted = Array.from({ length: configuration.numBrokers }, (v, k) => k)
          .sort((a, b) => {
            const aCount = topic.partitionsDistribution.filter(p => p.brokerId === a).length;
            const bCount = topic.partitionsDistribution.filter(p => p.brokerId === b).length;
            return aCount - bCount;
          });

        // Assign partitions to brokers in a round-robin fashion to maximize spread
        for (let i = 0; i < topic.numPartitions; i++) {
          const brokerId = brokersSorted[i % configuration.numBrokers];
          topic.partitionsDistribution.push({
            topicName: topic.topicName,
            partitionId: i,
            brokerId: brokerId,
            partitionKey: `${topic.topicName}-${i}`, // Unique key
          });
        }
      });
      initializing = false;
    };

    // Initialize partitions on component creation
    initializePartitions();

    // Function to handle configuration updates
    const updateConfiguration = (newConfig) => {
      if (initializing) return;

      if (newConfig.rebalancePartitions) {
        rebalancePartitions();
      } else if (newConfig.setEvenDistribution) {
        initializePartitions();
      } else {
        // Update configuration properties while maintaining reactivity
        for (const key in newConfig) {
          if (key === 'topics') {
            updateTopics(newConfig.topics);
          } else if (key === 'partitionsDistribution') {
            updatePartitionsDistribution(newConfig.partitionsDistribution);
          } else if (Object.prototype.hasOwnProperty.call(configuration, key)) {
            configuration[key] = newConfig[key];
          }
        }

        // Re-initialize partitions if number of partitions or brokers changes
        if (
          newConfig.numPartitions !== undefined ||
          newConfig.numBrokers !== undefined ||
          newConfig.topics !== undefined
        ) {
          initializePartitions();
        }
      }
    };

    const updateTopics = (newTopics) => {
      configuration.topics.length = newTopics.length;
      newTopics.forEach((newTopic, index) => {
        if (!configuration.topics[index]) {
          configuration.topics[index] = reactive({ ...newTopic });
        } else {
          // Detect if numPartitions has increased
          if (newTopic.numPartitions > configuration.topics[index].numPartitions) {
            const existingPartitions = configuration.topics[index].partitionsDistribution.length;
            const additionalPartitions = newTopic.numPartitions - existingPartitions;
            for (let i = existingPartitions; i < newTopic.numPartitions; i++) {
              const brokerId = getBrokerWithFewestPartitions();
              configuration.topics[index].partitionsDistribution.push({
                topicName: newTopic.topicName,
                partitionId: i,
                brokerId: brokerId,
                partitionKey: `${newTopic.topicName}-${i}`, // Unique key
              });
            }
          } else if (newTopic.numPartitions < configuration.topics[index].numPartitions) {
            // Handle reduction in partitions if necessary
            configuration.topics[index].partitionsDistribution = configuration.topics[index].partitionsDistribution.slice(0, newTopic.numPartitions);
          }
          Object.assign(configuration.topics[index], newTopic);
        }
      });
    };

    const updatePartitionsDistribution = (newPartitionsDistribution) => {
      configuration.topics.forEach((topic) => {
        topic.partitionsDistribution = newPartitionsDistribution.filter(
          (partition) => partition.topicName === topic.topicName
        );
      });
    };

    return {
      configuration,
      updateConfiguration,
      ...toRefs(configuration),
    };
  },
};
</script>

<style>
/* You can add global styles here if needed */
</style>
