// Event which is triggered when document is ready
$('document').ready(() => {
    calculateProgress();
})

function renderProgressCharts(progress){

    let vacChartObject = document.getElementById('vacChart').getContext('2d');
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
            segmentShowStroke: false
        }
    });
}

function calculateProgress(){
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
        sum = Number ((sum * 100).toFixed(2));

        overallProgress.vaccinated = sum;
        overallProgress.pending = 100 - sum;
    }

    // Render progress chart
    renderProgressCharts(overallProgress);

}
