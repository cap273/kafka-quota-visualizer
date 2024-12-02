<!-- src/components/SideBar.vue -->
<template>
  <v-card>
    <v-card-title>Kafka produce and throttling settings</v-card-title>
    <v-card-text>
      <v-form>
        <!-- First section: Kafka quota type -->
        <div>
          Under the Kafka quota type:
          <v-select
            :items="throttlingOptions"
            v-model="localConfig.throttlingType"
            dense
          ></v-select>
        </div>

        <!-- New section: Kafka client quota value -->
        <div class="mt-2">
          A Kafka client with a produce quota of type
          <strong>{{ localConfig.throttlingType }}</strong> and a value of:
          <v-text-field
            v-model.number="localConfig.quotaValue"
            label="Quota Value (MB/s)"
            type="number"
            dense
          ></v-text-field>
        </div>

        <!-- For each topic -->
        <div
          v-for="(topic, index) in localConfig.topics"
          :key="topic.topicName"
          class="mt-2"
        >
          <!-- Visual separation between topics -->
          <v-divider class="my-2" v-if="index > 0"></v-divider>

          <!-- Conditional text based on topic index -->
          <div>
            <span v-if="index === 0">
              is attempting to produce messages to Kafka topic "
              {{ topic.topicName }}" with a throughput of:
            </span>
            <span v-else>
              and is also attempting to produce messages to Kafka topic "
              {{ topic.topicName }}" with a throughput of:
            </span>
            <v-text-field
              v-model.number="topic.produceRate"
              :label="'Produce Rate to Topic ' + topic.topicName + ' (MB/s)'"
              type="number"
              dense
            ></v-text-field>
          </div>

          <!-- Third section: Number of partitions for topic -->
          <div>
            where topic "{{ topic.topicName }}" has the following number of
            partitions:
            <v-slider
              v-model.number="topic.numPartitions"
              :min="1"
              :max="20"
              :step="1"
              show-ticks
              :tick-size="4"
              dense
            ></v-slider>
            <div>
              Number of Partitions for Topic {{ topic.topicName }}:
              {{ topic.numPartitions }}
            </div>
          </div>
        </div>

        <!-- Buttons to add or remove topics -->
        <div class="mt-2">
          <v-btn @click="addTopic" small>Add Topic</v-btn>
          <v-btn
            @click="removeTopic"
            small
            v-if="localConfig.topics.length > 1"
            >Remove Latest Topic</v-btn
          >
        </div>

        <!-- Rebalance all partitions button -->
        <v-btn @click="rebalancePartitions" class="mt-2" small
          >Rebalance all partitions</v-btn
        >

        <!-- Visual segment -->
        <v-divider class="my-2"></v-divider>

        <!-- Fourth section: Number of brokers -->
        <div>
          the Kafka cluster has the following number of brokers:
          <v-slider
            v-model.number="localConfig.numBrokers"
            :min="1"
            :max="10"
            :step="1"
            show-ticks
            :tick-size="4"
            dense
          ></v-slider>
          <div>Number of Brokers: {{ localConfig.numBrokers }}</div>
        </div>

        <!-- Fifth section: Max broker throughput -->
        <div>
          where each broker has a maximum produce throughput of:
          <v-text-field
            v-model.number="localConfig.maxBrokerThroughput"
            label="Max Broker Throughput (MB/s)"
            type="number"
            dense
          ></v-text-field>
        </div>

        <!-- Sixth section: Background throughput -->
        <div>
          and the entire Kafka cluster is experiencing a background produce
          throughput of:
          <v-text-field
            v-model.number="localConfig.backgroundThroughput"
            label="Background Throughput (MB/s for the cluster)"
            type="number"
            dense
          ></v-text-field>
        </div>
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script>
import { defineComponent, reactive, watch } from 'vue';

export default defineComponent({
  name: 'SideBar',
  props: ['configuration'],
  setup(props, { emit }) {
    const throttlingOptions = ['Per Client Per Broker', 'Per Partition'];
    const localConfig = reactive({
      ...JSON.parse(JSON.stringify(props.configuration)),
      quotaValue: props.configuration.quotaValue || 100, // Default quota value
    });

    // Watch for changes and emit updates
    watch(
      () => localConfig,
      (newVal) => {
        emit('update-configuration', newVal);
      },
      { deep: true }
    );

    const rebalancePartitions = () => {
      emit('update-configuration', { rebalancePartitions: true });
    };

    const addTopic = () => {
      if (localConfig.topics.length === 0) {
        console.warn('No existing topics to copy configuration from.');
        return;
      }

      const firstTopic = localConfig.topics[0];
      const lastTopic = localConfig.topics[localConfig.topics.length - 1];
      const nextCharCode = lastTopic.topicName.charCodeAt(0) + 1;
      const newTopicName = String.fromCharCode(nextCharCode);

      // Ensure the new topic name is unique
      if (localConfig.topics.some((topic) => topic.topicName === newTopicName)) {
        console.warn(`Topic name "${newTopicName}" already exists. Choose a different name.`);
        return;
      }

      localConfig.topics.push({
        topicName: newTopicName,
        produceRate: firstTopic.produceRate, // Copy from the first topic
        numPartitions: firstTopic.numPartitions, // Copy from the first topic
        partitionsDistribution: [],
      });
    };

    const removeTopic = () => {
      if (localConfig.topics.length > 1) {
        localConfig.topics.pop();
      }
    };

    return {
      throttlingOptions,
      localConfig,
      rebalancePartitions,
      addTopic,
      removeTopic,
    };
  },
});
</script>

<style scoped>
/* Tighten up vertical spacing */
.v-card-text > * {
  margin-bottom: 8px;
}
</style>
