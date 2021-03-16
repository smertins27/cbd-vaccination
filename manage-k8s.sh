#!/bin/bash

# Launch minikube from a mac system and start setup of minikube
function kubernetesMac(){
  unset KUBECONFIG
  minikube start --memory 8192 --cpus 4 --vm-driver=hyperkit
  setup
}

# Launch minikube from a linux system and start setup of minikube
function kubernetesLinux(){
  unset KUBECONFIG
  sudo minikube start --memory 6144 --cpus 4 --vm-driver=none
  setup
}

# Setup basic for kubernetes in minikube
function setup(){
  minikube addons enable ingress
  helm repo add strimzi http://strimzi.io/charts/
  helm repo add stable https://charts.helm.sh/stable

  # Install kafka and strimzi cluster
  helm install my-kafka-operator strimzi/strimzi-kafka-operator
  kubectl apply -f kafka-cluster.yaml
  helm install --namespace=default --set hdfs.dataNode.replicas=1 --set yarn.nodeManager.replicas=1 --set hdfs.webhdfs.enabled=true my-hadoop-cluster stable/hadoop
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

# Stop local minikube kubernetes deployment
function stop(){
  clear
  minikube stop
}

$cmd $@
