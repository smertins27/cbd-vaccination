// Event which is triggered when document is ready
$('document').ready(() => {
    calculateProgress();
    renderCharts();
})

function renderCharts(){
    const sumVaccinations = 50;
    let vacChartObject = document.getElementById('vacChart').getContext('2d');
    let labels = ['Vaccinated', 'Not vaccinated'];

    let notVacPercentage = 100 - sumVaccinations;

    let chart = new Chart(vacChartObject, {
        type: 'pie',
        data: {
            datasets: [{
                data: [sumVaccinations, notVacPercentage],
                backgroundColor: [
                    '#50B432',
                    '#ED561B'
                ]
            }],
            labels: labels
        },
        options: {
            responsive: true
        }
    });
}

function calculateProgress(){
    console.log(vaccinationProgress);
    // Calculate progress depending if data exists
    if(vaccinationProgress.length > 0){

    }else{ // Fallback for default data

    }
}
