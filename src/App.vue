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
import { reactive, toRefs } from 'vue';
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
      quotaValue: 2, // MB/s
    });

    let initializing = false; // Flag to prevent recursive updates

    // Create a deep copy of the initial configuration for comparison
    const previousConfig = JSON.parse(JSON.stringify(configuration));

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
      console.log('Initializing partitions...');
      if (initializing) {
        console.log('Initialization already in progress. Skipping...');
        return;
      }
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
        console.log(`Initialized partitions for topic "${topic.topicName}":`, topic.partitionsDistribution);
      });
      initializing = false;
      console.log('Partition initialization complete.');
    };

    // Function to rebalance all partitions across brokers
    const rebalancePartitions = () => {
      console.log('Rebalancing partitions...');
      if (initializing) {
        console.log('Rebalancing already in progress. Skipping...');
        return;
      }
      initializing = true;
      configuration.topics.forEach((topic) => {
        // Clear current distribution
        topic.partitionsDistribution = [];
        // Collect all partitions
        const partitions = Array.from({ length: topic.numPartitions }, (v, k) => k);
        // Sort brokers by current number of partitions for this topic
        const brokersSorted = Array.from({ length: configuration.numBrokers }, (v, k) => k).sort((a, b) => {
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
        console.log(`Rebalanced partitions for topic "${topic.topicName}":`, topic.partitionsDistribution);
      });
      initializing = false;
      console.log('Partition rebalancing complete.');
    };

    // Initialize partitions on component creation
    initializePartitions();

    // Function to handle configuration updates
    const updateConfiguration = (newConfig) => {
      if (initializing) {
        console.log('Update received during initialization. Ignoring to prevent recursion.');
        return;
      }

      console.log('Received new configuration update:', newConfig);

      if (newConfig.rebalancePartitions) {
        console.log('Rebalance partitions flag detected.');
        rebalancePartitions();
        return;
      }

      if (newConfig.setEvenDistribution) {
        console.log('Set even distribution flag detected.');
        initializePartitions();
        return;
      }

      // Determine if rebalance is needed based on specific changes
      const shouldRebalance = determineIfRebalanceNeeded(newConfig, previousConfig);

      console.log('Determined shouldRebalance:', shouldRebalance);

      // Update configuration properties while maintaining reactivity
      for (const key in newConfig) {
        if (key === 'topics') {
          updateTopics(newConfig.topics);
        } else if (key === 'partitionsDistribution') {
          updatePartitionsDistribution(newConfig.partitionsDistribution);
        } else if (Object.prototype.hasOwnProperty.call(configuration, key)) {
          if (configuration[key] !== newConfig[key]) { // Only update if value has changed
            console.log(`Updating property "${key}" from`, configuration[key], 'to', newConfig[key]);
            configuration[key] = newConfig[key];
          } else {
            console.log(`Property "${key}" unchanged. Skipping update.`);
          }
        }
      }

      // Only re-initialize partitions if relevant properties have changed
      if (shouldRebalance) {
        console.log('Relevant changes detected. Reinitializing partitions...');
        initializePartitions();
      } else {
        console.log('No relevant changes detected. Skipping partition reinitialization.');
      }

      // Update the previous configuration copy
      updatePreviousConfig(newConfig);
    };

    // Function to determine if rebalance is needed
    const determineIfRebalanceNeeded = (newConfig, prevConfig) => {
      let rebalanceNeeded = false;

      // Check if 'numBrokers' has changed
      if ('numBrokers' in newConfig) {
        if (newConfig.numBrokers !== prevConfig.numBrokers) {
          console.log(`numBrokers changed from ${prevConfig.numBrokers} to ${newConfig.numBrokers}`);
          rebalanceNeeded = true;
        } else {
          console.log('numBrokers remains unchanged.');
        }
      }

      // Check if 'topics' have changed in terms of 'numPartitions' only
      if ('topics' in newConfig) {
        const newTopics = newConfig.topics;
        const prevTopics = prevConfig.topics;

        // If number of topics has changed, rebalance
        if (newTopics.length !== prevTopics.length) {
          console.log(`Number of topics changed from ${prevTopics.length} to ${newTopics.length}`);
          rebalanceNeeded = true;
        } else {
          // Iterate through each topic and compare 'numPartitions'
          for (let i = 0; i < newTopics.length; i++) {
            const newTopic = newTopics[i];
            const prevTopic = prevTopics[i];
            if (!prevTopic) {
              console.log(`New topic "${newTopic.topicName}" added.`);
              rebalanceNeeded = true;
              break;
            }
            if (newTopic.numPartitions !== prevTopic.numPartitions) {
              console.log(`numPartitions for topic "${newTopic.topicName}" changed from ${prevTopic.numPartitions} to ${newTopic.numPartitions}`);
              rebalanceNeeded = true;
            } else {
              console.log(`numPartitions for topic "${newTopic.topicName}" remains unchanged.`);
            }
          }
        }
      }

      return rebalanceNeeded;
    };

    // Function to update the previous configuration
    const updatePreviousConfig = (newConfig) => {
      for (const key in newConfig) {
        if (key === 'topics') {
          previousConfig.topics = JSON.parse(JSON.stringify(configuration.topics));
        } else {
          previousConfig[key] = configuration[key];
        }
      }
      console.log('Updated previousConfig:', previousConfig);
    };

    // Function to update topics
    const updateTopics = (newTopics) => {
      console.log('Updating topics...');
      // Update topics individually to prevent unnecessary reactivity triggers
      newTopics.forEach((newTopic, index) => {
        if (!configuration.topics[index]) {
          console.log(`Adding new topic "${newTopic.topicName}".`);
          configuration.topics[index] = reactive({ ...newTopic });
        } else {
          // Detect if numPartitions has increased
          if (newTopic.numPartitions > configuration.topics[index].numPartitions) {
            const existingPartitions = configuration.topics[index].partitionsDistribution.length;
            const additionalPartitions = newTopic.numPartitions - existingPartitions;
            console.log(`Increasing numPartitions for topic "${newTopic.topicName}" by ${additionalPartitions}.`);
            for (let i = existingPartitions; i < newTopic.numPartitions; i++) {
              const brokerId = getBrokerWithFewestPartitions();
              configuration.topics[index].partitionsDistribution.push({
                topicName: newTopic.topicName,
                partitionId: i,
                brokerId: brokerId,
                partitionKey: `${newTopic.topicName}-${i}`, // Unique key
              });
              console.log(`Added partition ${i} to broker ${brokerId} for topic "${newTopic.topicName}".`);
            }
          } else if (newTopic.numPartitions < configuration.topics[index].numPartitions) {
            console.log(`Decreasing numPartitions for topic "${newTopic.topicName}" from ${configuration.topics[index].numPartitions} to ${newTopic.numPartitions}.`);
            // Handle reduction in partitions if necessary
            configuration.topics[index].partitionsDistribution = configuration.topics[index].partitionsDistribution.slice(0, newTopic.numPartitions);
          }
          console.log(`Updating topic "${newTopic.topicName}".`);
          Object.assign(configuration.topics[index], newTopic);
        }
      });

      // Remove any extra topics if newTopics has fewer topics
      if (configuration.topics.length > newTopics.length) {
        const removedTopics = configuration.topics.splice(newTopics.length);
        removedTopics.forEach((topic) => {
          console.log(`Removed topic "${topic.topicName}".`);
        });
      }
      console.log('Topics updated:', configuration.topics);
    };

    // Function to update partitionsDistribution
    const updatePartitionsDistribution = (newPartitionsDistribution) => {
      console.log('Updating partitionsDistribution...');
      configuration.topics.forEach((topic) => {
        const newPartitions = newPartitionsDistribution.filter(
          (partition) => partition.topicName === topic.topicName
        );
        console.log(`Setting partitions for topic "${topic.topicName}":`, newPartitions);
        topic.partitionsDistribution = newPartitions;
      });
      console.log('partitionsDistribution updated for all topics.');
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
