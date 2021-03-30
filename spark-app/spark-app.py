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

vaccinationsProgress = trackingVaccination.groupBy(
    column("progressId").alias('id'),
    column("statesiso"),
    column("vaccinescode"),
    column("percentageInDb")
    
    
).agg(round(sum('percent'),6).alias('percentage'))



vaccinations = trackingVaccination.groupBy(
    column("vacId").alias('id'),
    column("vaccinescode"),
    column("statesiso"),
    column("vacAmountInDb")
).agg(sum('vac_amount').alias('vac_amount'))



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
# Start running the query

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
            # Run upsert (insert or update existing)
            if hasattr(row, 'vac_amount'):
                if row.vacAmountInDb is None:
                    vacAmount = row.vac_amount
                else:
                    vacAmount = row.vacAmountInDb + row.vac_amount
                if vacAmount is not None:
                    sql = session.sql("INSERT INTO vaccinations (id, vaccinescode, statesiso, vac_amount) VALUES ( ?, ?, ?, ?) ON DUPLICATE KEY UPDATE vac_amount = ?")
                    sql.bind(row.id, row.vaccinescode, row.statesiso, row.vac_amount, vacAmount).execute()
            
    
            elif hasattr(row, 'percentage'):
                if row.percentageInDb is None:
                    percentage = str(Decimal(row.percentage))
                else:
                    percentage = str(Decimal(row.percentageInDb + row.percentage))
                
                if percentage is not None:
                    sql = session.sql("INSERT INTO vaccination_progress (id, percentage, statesiso, vaccinescode) VALUES ( ?, ?, ?, ?) ON DUPLICATE KEY UPDATE percentage = ?")
                    sql.bind(row.id, percentage, row.statesiso, row.vaccinescode, percentage).execute()
        
        
        session.close()


    # Perform batch UPSERTS per data partition
    batchDataframe.foreachPartition(save_to_db) 


# Example Part 7
# Start Insert Stream

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
