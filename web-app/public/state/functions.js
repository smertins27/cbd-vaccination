// Event which is triggered when document is ready
$('document').ready(() => {
    renderCharts();
})

function renderCharts(){
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
