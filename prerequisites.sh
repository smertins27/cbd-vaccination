#!/bin/bash

# Prepare Kubernetes for usage with Skaffold
# Ensure that the strizmi operator is running and a kafka cluster
function start(){
  unset KUBECONFIG
  minikube start --memory 8192 --cpus 6 --vm-driver=hyperkit
  helm repo add strimzi http://strimzi.io/charts/
  helm install my-kafka-operator strimzi/strimzi-kafka-operator
  kubectl apply -f https://farberg.de/talks/big-data/code/helm-kafka-operator/kafka-cluster-def.yaml

  helm repo add stable https://charts.helm.sh/stable
  helm install --namespace=default --set hdfs.dataNode.replicas=1 --set yarn.nodeManager.replicas=1 --set hdfs.webhdfs.enabled=true my-hadoop-cluster stable/hadoop
}

# Delete the minikube und spawn a new one
function reset(){
  minikube delete
  minikube start --memory 8192 --cpus 6 --vm-driver=hyperkit
}

$cmd $@
