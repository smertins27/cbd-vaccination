#!/bin/bash
# Start Kubernetes in minikube from scratch.
# Launch minikube and add needed helm charts
# Call start function
function setup(){
  unset KUBECONFIG
  minikube start --memory 8192 --cpus 4 --vm-driver=hyperkit
  minikube addons enable ingress
  helm repo add strimzi http://strimzi.io/charts/
  helm repo add stable https://charts.helm.sh/stable

  start
}

# Install and start strimzi kafka cluster
# Install and start hadoop cluster
function start(){
  helm install my-kafka-operator strimzi/strimzi-kafka-operator
  kubectl apply -f kafka-cluster.yaml
  helm install --namespace=default --set hdfs.dataNode.replicas=1 --set yarn.nodeManager.replicas=1 --set hdfs.webhdfs.enabled=true my-hadoop-cluster stable/hadoop

  # Not used -> Caused errors on kafka cluster. Better run manual after everything is up and running
  # skaffold dev
}

# Clear the whole minikube to get a clean base
function clear() {
  kubectl delete --all deployments
  kubectl delete --all services
  kubectl delete --all apps

  helm uninstall my-kafka-operator
  kubectl delete -f kafka-cluster.yaml
  helm delete my-hadoop-cluster
}

# Reset minikube: Call clear and start function
function reset(){
  clear
  start
}

$cmd $@
