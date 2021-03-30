from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import IntegerType, StringType, StructType, FloatType, TimestampType, DecimalType, LongType, DecimalType
import mysqlx
from decimal import Decimal
import math

dbOptions = {"host": "my-app-mysql-service", 'port': 33060, "user": "root", "password": "mysecretpw"}
dbSchema = 'popular'
windowDuration = '5 minutes'
slidingDuration = '3 minutes'

# Example Part 1
# Create a spark session
spark = SparkSession.builder \
    .appName("Structured Streaming").getOrCreate()

# Set log level
spark.sparkContext.setLogLevel('WARN')

# Example Part 2
# Read messages from Kafka
kafkaMessages = spark \
    .readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers",
            "my-cluster-kafka-bootstrap:9092") \
    .option("subscribe", "tracking-data") \
    .option("startingOffsets", "earliest") \
    .load()

# Define schema of tracking data
  
trackingVaccinationsSchema = StructType() \
    .add("statesiso", StringType()) \
    .add("vac_amount", LongType()) \
    .add("vaccinescode", StringType()) \
    .add("timestamp", IntegerType())  \
    .add("percent", DecimalType(20,10))  \
    .add("vacId", IntegerType())   \
    .add("progressId", IntegerType()) \
    .add("vacAmountInDb", IntegerType()) \
    .add("percentageInDb", DecimalType(20, 10))   
    
# Example Part 3
# Convert value: binary -> JSON -> fields + parsed timestamp

trackingVaccination = kafkaMessages.select(
    from_json(
        column("value").cast("string"),
        trackingVaccinationsSchema
    ).alias("json")
).select(
    from_unixtime(column('json.timestamp'))
    .cast(TimestampType())
    .alias("parsed_timestamp"),

    column("json.*")
) \
    .withColumnRenamed('json.statesiso', 'statesiso') \
    .withColumnRenamed('json.vac_amount', 'vac_amount') \
    .withColumnRenamed('json.vaccinescode', 'vaccinescode') \
    .withColumnRenamed('json.percent', 'percent') \
    .withColumnRenamed('json.progressId', 'progressId') \
    .withColumnRenamed('json.vacId', 'vacId') \
    .withColumnRenamed('json.vacAmountInDb', 'vacAmountInDb') \
    .withColumnRenamed('json.percentageInDb', 'percentageInDb') \
    .withWatermark("parsed_timestamp", windowDuration)

    

# Example Part 4
# Compute most popular slides

# Example Part 5
# Start running the query; print running counts to the console
    .writeStream \
    .trigger(processingTime=slidingDuration) \
    .outputMode("update") \
    .format("console") \
    .option("truncate", "false") \



    # Define function to save a dataframe to mysql
    def save_to_db(iterator):
        # Connect to database and use schema
        session = mysqlx.get_session(dbOptions)
        for row in iterator:
            # Run upsert (insert or update existing)
        session.close()

    # Perform batch UPSERTS per data partition

# Example Part 7


    .trigger(processingTime=slidingDuration) \
    .outputMode("update") \

# Wait for termination
spark.streams.awaitAnyTermination()
