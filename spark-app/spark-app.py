from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import IntegerType, StringType, StructType, TimestampType, FloatType, LongType, DecimalType
import mysqlx

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
"""  trackingMessageSchema = StructType() \
    .add("mission", StringType()) \
    .add("timestamp", IntegerType()) """
  
trackingVaccinationsSchema = StructType() \
    .add("statesiso", StringType()) \
    .add("vac_amount", LongType()) \
    .add("vaccinescode", StringType()) \
    .add("timestamp", IntegerType())  \
    .add("percent", FloatType())  \
    .add("vacId", IntegerType())   \
    .add("progressId", IntegerType())    
    # .add("percentage", FloatType())    
# Example Part 3
# Convert value: binary -> JSON -> fields + parsed timestamp
""" trackingMessages = kafkaMessages.select(
    # Extract 'value' from Kafka message (i.e., the tracking data)
    from_json(
        column("value").cast("string"),
        trackingMessageSchema
    ).alias("json")
).select(
    # Convert Unix timestamp to TimestampType
    from_unixtime(column('json.timestamp'))
    .cast(TimestampType())
    .alias("parsed_timestamp"),

    # Select all JSON fields
    column("json.*")
) \
    .withColumnRenamed('json.mission', 'mission') \
    .withWatermark("parsed_timestamp", windowDuration) """


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
    .withWatermark("parsed_timestamp", windowDuration)

    

# Example Part 4
# Compute most popular slides
""" popular = trackingMessages.groupBy(
    window(
        column("parsed_timestamp"),
        windowDuration,
        slidingDuration
    ),
    column("mission")
).count().withColumnRenamed('count', 'views') """

vaccinationsProgress = trackingVaccination.groupBy(
    window(
        column("parsed_timestamp"),
        windowDuration,
        slidingDuration
    ),
    column("progressId"),
    column("statesiso"),
    column("vaccinescode")
    
    
).agg(sum('percent').alias('percentage'))


print(vaccinationsProgress)

vaccinations = trackingVaccination.groupBy(
    window(
        column("parsed_timestamp"),
        windowDuration,
        slidingDuration
    ),
    column("vacId"),
    column("vaccinescode"),
    column("statesiso")
).agg(sum('vac_amount').alias('vac_amount'), avg('vac_amount').alias('vac_amount_average'))



# Example Part 5
# Start running the query; print running counts to the console
""" consoleDump = popular \
    .writeStream \
    .trigger(processingTime=slidingDuration) \
    .outputMode("update") \
    .format("console") \
    .option("truncate", "false") \
    .start() """

consoleVaccinationsDumb = vaccinations \
    .writeStream \
    .trigger(processingTime=slidingDuration) \
    .outputMode("update") \
    .format("console") \
    .option("truncate", "false") \
    .start()

 

consoleVaccinationsProgressDumb = vaccinationsProgress \
    .writeStream \
    .trigger(processingTime=slidingDuration) \
    .outputMode("update") \
    .format("console") \
    .option("truncate", "false") \
    .start()               

# Save to Vaccinations


def saveToVaccinationsDatabase(batchDataframe, batchId):
    # Define function to save a dataframe to mysql

    def save_to_db(iterator):
        
        # Connect to database and use schema
        session = mysqlx.get_session(dbOptions)
        session.sql("USE vaccination").execute()
        for row in iterator:
            print(row)
            # Run upsert (insert or update existing)
            if hasattr(row, 'vacId'):
                print(row.vacId)
                print(row.vaccinescode)
                print(row.statesiso)
                print(row.vac_amount)
                print(row.vac_amount_average)
                sql = session.sql("INSERT INTO vaccinations (id, vaccinescode, statesiso, vac_amount, vac_amount_average) VALUES ( ?, ?, ?, ?) ON DUPLICATE KEY UPDATE vac_amount = ?, vac_amount_average = ?")
                sql.bind(row.vacId, row.vaccinescode, row.statesiso, row.vac_amount, row.vac_amount_average, row.vac_amount).execute()
            
    
            elif hasattr(row, 'progressId'):
                print("vaccination_progress")
                print(row.progressId)
                sql = session.sql("INSERT INTO vaccination_progress (id, percentage, statesiso, vaccinescode) VALUES ( ?, ?, ?) ON DUPLICATE KEY UPDATE percentage = ?")
                sql.bind(row.progessId, row.percentage, row.statesiso, row.vaccinescode, row.percentage)
        session.close()

    # Perform batch UPSERTS per data partition
    batchDataframe.foreachPartition(save_to_db) 

 
    # Save to vaccination progress


""" def saveToDatabase(batchDataframe, batchId):
    # Define function to save a dataframe to mysql
    def save_to_db(iterator):
        # Connect to database and use schema
        session = mysqlx.get_session(dbOptions)
        session.sql("USE vaccinations").execute()

        for row in iterator:
            # Run upsert (insert or update existing)
            sql = session.sql("INSERT INTO popular "
                              "(mission, count) VALUES (?, ?) "
                              "ON DUPLICATE KEY UPDATE count=?")
            sql.bind(row.mission, row.views, row.views).execute()

        session.close()

    # Perform batch UPSERTS per data partition
    batchDataframe.foreachPartition(save_to_db) """

# Example Part 7


""" dbInsertStream = popular.writeStream \
    .trigger(processingTime=slidingDuration) \
    .outputMode("update") \
    .foreachBatch(saveToDatabase) \
    .start() """

vaccinationInsertStream = vaccinations.writeStream \
    .trigger(processingTime=slidingDuration) \
    .outputMode("update") \
    .foreachBatch(saveToVaccinationsDatabase) \
    .start() 

vaccinationsProgressInsertStream = vaccinationsProgress.writeStream \
    .trigger(processingTime=slidingDuration) \
    .outputMode("update") \
    .foreachBatch(saveToVaccinationsDatabase) \
    .start() 

# Wait for termination
spark.streams.awaitAnyTermination()
