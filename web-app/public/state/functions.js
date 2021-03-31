// Event which is triggered when document is ready
$('document').ready(() => {
    renderCharts();
})

/**
 * Method for rendering the progress chart
 * @param progress Object which contains the progress
 */
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

/**
 * Method for render the vaccines distribution chart
 * @param chartElements Object which contains labels and values elements
 */
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

/**
 * Generic method for render the charts and calculate the needed data
 */
function renderCharts(){
    // Render percentage progress chart
    const percentageProgress = calculatePercentageProgress();
    renderProgressChart(percentageProgress);

    // Render vaccines distribution chart
    const vaccinesDistribution = calculateVaccinesDistribution();
    renderDistributionChart(vaccinesDistribution);

}

/**
 * Method for calculation of the progress on existing data
 * @return {{pending: number, vaccinated: number}}
 */
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

/**
 * Method for vaccines distribution calculation
 * @return {{values: [], labels: []}}
 */
function calculateVaccinesDistribution(){
    const labels = [];
    const values = [];

    let vaccinesDistribution = 0;
    vaccinationProgress.forEach(vaccination => {
        vaccinesDistribution += roundFloat(vaccination.percentage * 100);
    });
    vaccinationProgress.forEach(vaccination => {
        const vaccineDistribution = roundFloat(vaccination.percentage * 100);
        const distribution = vaccineDistribution / vaccinesDistribution * 100;
        values.push(roundFloat(distribution));

        const vaccine = vaccines.find(vac => vac.code === vaccination.vaccinescode)
        labels.push(vaccine.name);

    })

    return {labels, values};
}

/**
 * Helper method for round a float
 * @param number Number which needed to be rounded
 * @param fractionDigits Number of decimal places (default = 2)
 * @return {number}
 */
function roundFloat(number, fractionDigits = 2){
    return Number ((number).toFixed(fractionDigits))
}
