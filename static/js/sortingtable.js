$(document).ready(function () {
    // Enable sorting on click
    $('th').click(function () {
        var table = $('#sortable-table');
        var index = $(this).index();
        var rows = table.find('tbody > tr').get();
        var isAscending = $(this).hasClass('asc');

        // Remove asc/desc classes from all headers
        $('th').removeClass('asc desc');

        // Toggle between ascending and descending
        if (isAscending) {
            // Sort in descending order
            $(this).addClass('desc');
            rows.sort(function (a, b) {
                var A = $(a).children('td').eq(index).text().toUpperCase();
                var B = $(b).children('td').eq(index).text().toUpperCase();
                return B.localeCompare(A);
            });
        } else {
            // Sort in ascending order
            $(this).addClass('asc');
            rows.sort(function (a, b) {
                var A = $(a).children('td').eq(index).text().toUpperCase();
                var B = $(b).children('td').eq(index).text().toUpperCase();
                return A.localeCompare(B);
            });
        }

        // Append the sorted rows to the table
        $.each(rows, function (index, row) {
            table.children('tbody').append(row);
        });
    });
});
