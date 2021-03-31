// Event which is triggered when document is ready
$('document').ready(() => {
    renderCharts();
})

function renderProgressChart(progress){

    let vacChartObject = document.getElementById('progressChart').getContext('2d');
    let labels = ['Vaccinated', 'Pending'];

    let chart = new Chart(vacChartObject, {
        type: 'pie',
        data: {
            datasets: [{
                data: [progress.vaccinated, progress.pending],
                backgroundColor: [
                    '#50B432',
                    '#808080'
                ],
                borderWidth: 0
            }],
            labels: labels
        },
        options: {
            legend: false,
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function renderDistributionChart(chartElements){
    let vacChartObject = document.getElementById('distributionChart').getContext('2d');

    let chart = new Chart(vacChartObject, {
        type: 'bar',
        data: {
            datasets: [{
                data: chartElements.values,
                borderWidth: 0,
                backgroundColor: "#33AEEF",
            }],
            labels: chartElements.labels
        },
        options: {
            legend: false,
            responsive: true,
            maintainAspectRatio: false,
        }
    });
}

function renderCharts(){
    // Render percentage progress chart
    const percentageProgress = calculatePercentageProgress();
    renderProgressChart(percentageProgress);

    // Render vaccines distribution chart
    const vaccinesDistribution = calculateVaccinesDistribution();
    renderDistributionChart(vaccinesDistribution);

}

function calculatePercentageProgress(){
    let overallProgress = {
        vaccinated: 0,
        pending: 100
    }
    // Calculate progress depending if data exists
    if(vaccinationProgress.length > 0){
        let sum = 0;
        vaccinationProgress.forEach(progress => {
            sum += progress.percentage;
        });

        // Round sum of vaccination
        sum = roundFloat(sum * 100);

        overallProgress.vaccinated = sum;
        overallProgress.pending = 100 - sum;
    }

    return overallProgress;
}

function roundFloat(number, fractionDigits = 2){
    return Number ((number).toFixed(fractionDigits))
}

function calculateVaccinesDistribution(){
    const labels = [];
    const values = [];

    let vaccinesDistribution = 0;
    vaccinationProgress.forEach(vaccination => {
        vaccinesDistribution += roundFloat(vaccination.percentage * 100);
    })

    vaccinationProgress.forEach(vaccination => {
        const vaccineDistribution = roundFloat(vaccination.percentage * 100);
        const distribution = vaccineDistribution / vaccinesDistribution * 100;
        values.push(roundFloat(distribution));

        const vacName = vaccines.find(vac => vac.code === vaccination.vaccinescode).name
        labels.push(vacName);
    })

    return {labels, values};
}
