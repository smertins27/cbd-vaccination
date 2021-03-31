# Hochschule Bremen - Wintersemester 2020/2021 - Module: Cloud & Big Data

## Vaccination Progress Dashboard
Fighting together the current Covid-19 crisis with our dashboard to track the vaccination progress of all German federal states.
Track the progress of the vaccinations of your federal state and get more information about the used vaccine.

This use case is implemented by **Sebastian Mertins**, **Pascal Seegers** and **Tom Seevers**.

For a quick overview you are able to find a screencast of our application in *documentation*.

##Idea: Dashboard for all German federal states and their vaccination progress
First we thought about a dashboard for the world vaccination progress, which presents the progress of all countries in the world.
In that use case we weren't able to achieve the Big Data character due the missing insert and update of data. So we decided to create a fictional dashboard for Germany and its federal states only.
To work with data and process them, we've planned a fictional use case for this dashboard. A user is able to add new vaccinations which are added to the vaccination progress of a federal state.
Furthermore, we added the opportunity to select between different vaccines for the vaccination progress to display the distribution of used vaccines and progress for each federal state.

## Architecture
![Architecture](https://raw.githubusercontent.com/smertins27/cbd-vaccination/master/documentation/images/Architecture.png)

For the Big Data Science application we are using a Kubernetes Cluster which is locally provided by a minikube/microk8s.
This allows us to run a scalable development structure and react to higher traffic/load by starting new instances of the web and cache server and the big data services.

The mentioned load balancer is provided by Kubernetes with an ingress and distributes the traffic to multiple webservers. In our case we are only using one webserver to keep the use case as simple as possible.
For making the webserver application accessible to users, we are using NodeJS with Express for displaying the content.

As shown in the architecture picture, the web server grants its data from a cache or MySQL server. The usage of multiple cache servers, implemented by a memcached-cluster, relieves the database and allows a higher scalability of the application.
The web server doesn't insert data directly into the database. For that case there is a Kafka cluster running, which is working as a big data message service.
That cluster docks on the Spark application, which is also running inside the same cluster. That Spark Application, computes the message data from Kafka and sends it directly into the database or the checkpoints will be stored into the Data Lake.
The Data Lake is provided by a HDFS cluster.

### Database Design
![Database Design](https://raw.githubusercontent.com/smertins27/cbd-vaccination/master/documentation/images/MySQL_Database.png)

The following image gives a slight overview about our database structure.
Mainly we are using four tables, which hold the complete data of the project.
The tables **states** and **vaccines** are preloaded with content to ensure that the application runs properly.
The remaining tables are fed with dynamic user generated or batch calculated data, which is inserted via kafka and batch processing.

## Workflow and file structure
![Workflow](https://raw.githubusercontent.com/smertins27/cbd-vaccination/master/documentation/images/Workflow.png)

In this use case there are no automatically generated points to start the workflow process. First the *web-app/index.js* provides the HTML, CSS and JavaScript files to a user.
With usage of the Express package there are several routes for the application defined. If a user submits the form from the index page the data for processing is generated and sent via POST-Request to */vaccinations*.
This route is defined in the earlier mentioned *index.js*. This triggers the Kafka producer and sends the vaccinationTrackingMessage to the Spark application *spark-app/spark-app.py*. Spark starts the batch processing and computes the needed data.
After that the processed data is going to be stored in the database and some checkpoints will be written into HDFS.

If the user navigates to a state page the *index.js* receives the called route and will collect all data needed. In this case the state, vaccine and vaccination progress is fetched. First the cache is checked if the data is already present, if not, a database query is performed.
After that the data is parsed into the template to render the page properly.

### Generating data

The user generated data consists of the same data which is filled with information from a simple form.
To simulate the Big Data character and to stress the batch processing a huge amount of data entries can be randomly generated by a JavaScript function.

```
{ 
	vaccinescode: 'bnt', 
	statesiso: 'NI',
	vac_amount: 1500,
	timestamp: 1617195643,
	percent: 0.1152568,
	vacId: 0,
	progressId: 0,
	vacAmountInDb: 0,
	percentageInDb: 0	
}
```

Via the function *add random vaccinations* the Client produces up to 15 inserts at the same time. The application will then select all data from the tables vaccinations and vaccination_progress where the statesiso and vaccinescode is the same as the generated data.
If there's no data available for this specific state with this specific vaccine the fields *vacId*, *progressId*, *vacAmountInDb* and *percentageInDb* won't be changed and remain 0. 
Else these fields will be updated and inserted in the object seen above. 

This object will be sent to kafka and spark fetches the data from kafka. Spark needs a defined schema to resolve the data which is used to convert the from kafka received data. The input data is binary and gets converted into JSON and then into fields.

### Data calculation

After that the fields get grouped into *vaccinations* and *vaccinationProgress*. For the vaccination progress the percentage with all same states and same vaccines get summed up into one entry. For the vaccinations the vac_amount with same states and same vaccines also get summed up into one entry.

The query for the console dump starts after the sliding duration is over. The exact same happens for every batch and the insert stream for writing into database gets started. Dataframes then get inserted into database by the function *saveToVaccinationsDatabase* which will accept a batchframe and batchid. MySQL uses the database schema vaccination and spark SQL runs an upsert for every partition in the batchframe. If the partition has got the attribute *vac_amount* the function knows that this needs to be inserted into the table vaccinations. If it has the attribute percentage it knows that this has to be written into vaccination_progress.

Here the function needs the provided field *vacAmountInDb* or *percentageInDb*. The new percentage will be calculated by adding the *percentageInDb* from the database to the generated percentage *percent*. This will also be done for the vaccinations with the *vac_amount*. 

To run an upsert the function needs the key to check for duplicate keys. These keys are the *vacId* for the vaccinations and the *progressId* for the vaccination_progress. When there's no data available for the id's new data will be inserted and a new id will be given. 


## Templating and external libraries
### EJS
To ensure a cleaner project structure und archive an improved separation of concerns we've decided to use the *Embedded JavaScript Templates* for rendering the pages.
This provides a separation of logic and the visible structure. Further we were able to reduce the *index.js* to the needed routes and the parts for Kafka, Memcached, MySQL and Express itself.
As a result of that implementation, the project got much cleaner, understandable and the *index.js* handles the complex app logic.

For this use case we have implemented two routes for displaying the application. The root route */* is used to render the index page which serves its data from */web-app/public/overview*.
The second route */state/:iso* servers all files from */web-app/public/state*. Both of those routes use the static style files from */web-app/style/style.css*.

### Chart.JS
To provide a user-friendly data representation and design the generated data is visualized by fancy charts and is not presented by a simple list.
For reducing the development effort the library *ChartJS* is included into this project.
That possibility of the usage of different chart types provide a much better and understandable comparison between the generated data, like the percentage of vaccinated persons in relation to the population.

### jQuery
For providing a much easier handling of common JavaScripts functions, like submitting a form or sending data to an url, the library *jQuery* is included into the project.


## Prerequisites

### Required software
To develop and deploy the project in a local Kubernetes some software requirements need to be installed.
This case shows the commands for macOS:

- A installed running Minikube: `brew install minikube && minikube start --memory 8192 --cpus 4 --vm-driver=hyperkit`
- Skaffold installed: `brew install skaffold`
- Helm installed: `brew install helm`
- Ingress for minikube enabled `minikube addons enable ingress`

#### Required software for the cluster

- A running Strimzi.io Kafka operator
```bash
helm repo add strimzi http://strimzi.io/charts/
helm install my-kafka-operator strimzi/strimzi-kafka-operator
kubectl apply -f https://farberg.de/talks/big-data/code/helm-kafka-operator/kafka-cluster-def.yaml
```
- A running Hadoop cluster with YARN (for checkpointing)
```bash
helm delete my-hadoop-cluster # delete existing cluster beforehand, elsewise there might be errors
helm repo add stable https://charts.helm.sh/stable
helm install --namespace=default --set hdfs.dataNode.replicas=1 --set yarn.nodeManager.replicas=1 --set hdfs.webhdfs.enabled=true my-hadoop-cluster stable/hadoop
```

## Script to easier meet the prerequisites
For an easier local development we had written a simple script to meet the requirements. That scripts allow to setup and start the developmental minikube for **macOS** and **Linux**.
On machines running with linux there need to be **Docker** installed. On both operating system minikube needs to be installed too.

***Mark script as executable***
```bash
chmod +x ./manage-k8s.sh
```

***Starting develop-environment with minikube***
```bash
# Running on macOS (4 CPUs, 8GB Ram)
./manage-k8s.sh k8sMac 
# Running on linux (4 CPUs, 6GB Ram)
./manage-k8s.sh k8sLinux
```

***Stop and shutown the minikube***
```bash
# Stop local minikube kubernetes deployment
./manage-k8s.sh stop
```

### Deploy

To develop using [Skaffold](https://skaffold.dev/), use `skaffold dev`.

# References
A special thanks to our lecturer Prof. Dr.-Ing. habil. Dennis Pfisterer for the great and exciting module, and the opportunity to gain a hugh amount of knowledge about Cloud & Big Data.

Also, we are very thankfully for providing the use case *Missions* which served as our project basis.

# License
## Creative Commons CC0 1.0 Universal

CREATIVE COMMONS CORPORATION IS NOT A LAW FIRM AND DOES NOT PROVIDE LEGAL SERVICES. DISTRIBUTION OF THIS DOCUMENT DOES NOT CREATE AN ATTORNEY-CLIENT RELATIONSHIP. CREATIVE COMMONS PROVIDES THIS INFORMATION ON AN "AS-IS" BASIS. CREATIVE COMMONS MAKES NO WARRANTIES REGARDING THE USE OF THIS DOCUMENT OR THE INFORMATION OR WORKS PROVIDED HEREUNDER, AND DISCLAIMS LIABILITY FOR DAMAGES RESULTING FROM THE USE OF THIS DOCUMENT OR THE INFORMATION OR WORKS PROVIDED HEREUNDER.

### Statement of Purpose

The laws of most jurisdictions throughout the world automatically confer exclusive Copyright and Related Rights (defined below) upon the creator and subsequent owner(s) (each and all, an "owner") of an original work of authorship and/or a database (each, a "Work").

Certain owners wish to permanently relinquish those rights to a Work for the purpose of contributing to a commons of creative, cultural and scientific works ("Commons") that the public can reliably and without fear of later claims of infringement build upon, modify, incorporate in other works, reuse and redistribute as freely as possible in any form whatsoever and for any purposes, including without limitation commercial purposes. These owners may contribute to the Commons to promote the ideal of a free culture and the further production of creative, cultural and scientific works, or to gain reputation or greater distribution for their Work in part through the use and efforts of others.

For these and/or other purposes and motivations, and without any expectation of additional consideration or compensation, the person associating CC0 with a Work (the "Affirmer"), to the extent that he or she is an owner of Copyright and Related Rights in the Work, voluntarily elects to apply CC0 to the Work and publicly distribute the Work under its terms, with knowledge of his or her Copyright and Related Rights in the Work and the meaning and intended legal effect of CC0 on those rights.

1. __Copyright and Related Rights.__ A Work made available under CC0 may be protected by copyright and related or neighboring rights ("Copyright and Related Rights"). Copyright and Related Rights include, but are not limited to, the following:

   i. the right to reproduce, adapt, distribute, perform, display, communicate, and translate a Work;

   ii. moral rights retained by the original author(s) and/or performer(s);

   iii. publicity and privacy rights pertaining to a person's image or likeness depicted in a Work;

   iv. rights protecting against unfair competition in regards to a Work, subject to the limitations in paragraph 4(a), below;

   v. rights protecting the extraction, dissemination, use and reuse of data in a Work;

   vi. database rights (such as those arising under Directive 96/9/EC of the European Parliament and of the Council of 11 March 1996 on the legal protection of databases, and under any national implementation thereof, including any amended or successor version of such directive); and

   vii. other similar, equivalent or corresponding rights throughout the world based on applicable law or treaty, and any national implementations thereof.

2. __Waiver.__ To the greatest extent permitted by, but not in contravention of, applicable law, Affirmer hereby overtly, fully, permanently, irrevocably and unconditionally waives, abandons, and surrenders all of Affirmer's Copyright and Related Rights and associated claims and causes of action, whether now known or unknown (including existing as well as future claims and causes of action), in the Work (i) in all territories worldwide, (ii) for the maximum duration provided by applicable law or treaty (including future time extensions), (iii) in any current or future medium and for any number of copies, and (iv) for any purpose whatsoever, including without limitation commercial, advertising or promotional purposes (the "Waiver"). Affirmer makes the Waiver for the benefit of each member of the public at large and to the detriment of Affirmer's heirs and successors, fully intending that such Waiver shall not be subject to revocation, rescission, cancellation, termination, or any other legal or equitable action to disrupt the quiet enjoyment of the Work by the public as contemplated by Affirmer's express Statement of Purpose.

3. __Public License Fallback.__ Should any part of the Waiver for any reason be judged legally invalid or ineffective under applicable law, then the Waiver shall be preserved to the maximum extent permitted taking into account Affirmer's express Statement of Purpose. In addition, to the extent the Waiver is so judged Affirmer hereby grants to each affected person a royalty-free, non transferable, non sublicensable, non exclusive, irrevocable and unconditional license to exercise Affirmer's Copyright and Related Rights in the Work (i) in all territories worldwide, (ii) for the maximum duration provided by applicable law or treaty (including future time extensions), (iii) in any current or future medium and for any number of copies, and (iv) for any purpose whatsoever, including without limitation commercial, advertising or promotional purposes (the "License"). The License shall be deemed effective as of the date CC0 was applied by Affirmer to the Work. Should any part of the License for any reason be judged legally invalid or ineffective under applicable law, such partial invalidity or ineffectiveness shall not invalidate the remainder of the License, and in such case Affirmer hereby affirms that he or she will not (i) exercise any of his or her remaining Copyright and Related Rights in the Work or (ii) assert any associated claims and causes of action with respect to the Work, in either case contrary to Affirmer's express Statement of Purpose.

4. __Limitations and Disclaimers.__

   a. No trademark or patent rights held by Affirmer are waived, abandoned, surrendered, licensed or otherwise affected by this document.

   b. Affirmer offers the Work as-is and makes no representations or warranties of any kind concerning the Work, express, implied, statutory or otherwise, including without limitation warranties of title, merchantability, fitness for a particular purpose, non infringement, or the absence of latent or other defects, accuracy, or the present or absence of errors, whether or not discoverable, all to the greatest extent permissible under applicable law.

   c. Affirmer disclaims responsibility for clearing rights of other persons that may apply to the Work or any use thereof, including without limitation any person's Copyright and Related Rights in the Work. Further, Affirmer disclaims responsibility for obtaining any necessary consents, permissions or other rights required for any use of the Work.

   d. Affirmer understands and acknowledges that Creative Commons is not a party to this document and has no duty or obligation with respect to this CC0 or use of the Work.

