using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;
using gTools.Log;
using System.Collections;
using System.Collections.ObjectModel;
using System.Text.RegularExpressions;

namespace TagCreator
{
    /// <summary>
    /// Interaction logic for AttributesControl.xaml
    /// </summary>
    public partial class TemplateAttributesControl : UserControl, INotifyPropertyChanged
    {
        #region Initialization

        public event PropertyChangedEventHandler PropertyChanged;

        private AttributeBase _currentAttribute;
        private Point _dragDropStartPosition;

        public TemplateAttributesControl()
        {
            InitializeComponent();

            this.DataContext = this;
        }

        #endregion

        #region Properties

        public EngineeringParentProxy ParentProxy
        {
            get;
            set;
        }

        public MainWindow MainWindow
        {
            get;
            set;
        }

        public IEnumerable DataGridItemsSource
        {
            get
            {
                return _dataGrid.ItemsSource;
            }
            set
            {
                _dataGrid.ItemsSource = value;
            }
        }

        #endregion

        #region Data Binding

        public AttributeBase CurrentAttribute
        {
            get
            {
                return _currentAttribute;
            }
            set
            {
                _currentAttribute = value;
                NotifyPropertyChanged("CurrentAttribute");
                NotifyPropertyChanged("IsDataGridTemplateSelection");
            }
        }

        public bool IsDataGridTemplateSelection
        {
            get
            {
                return _currentAttribute != null && ParentProxy.IsTemplateSelected;
            }
        }

        #endregion

        #region Events

        private void AddAttributeButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                TemplateAttribute attribute = new TemplateAttribute();
                attribute.Id = ParentProxy.CurrentTemplate.Attributes.GetNextId();

                ParentProxy.CurrentTemplate.AddAttribute(attribute);
                ShowEditWindow(attribute);
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void DeleteAttributeButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (MainWindow.Confirm("Are you sure that you want to delete attribute {0}?", _currentAttribute.Name) != true)
                    return;

                ParentProxy.CurrentTemplate.RemoveAttribute((TemplateAttribute)_currentAttribute);

                // Reassign IDs after deletion
                ReassignIds();

                ParentProxy.NotifyPropertyChanged("TemplateLastModification");
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void DuplicateAttributeButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                TemplateAttribute attribute = new TemplateAttribute((TemplateAttribute)_currentAttribute) { Id = ParentProxy.CurrentTemplate.Attributes.GetNextId() };

                ParentProxy.CurrentTemplate.AddAttribute(attribute);
                ShowEditWindow(attribute);
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void _dataGrid_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            CurrentAttribute = (AttributeBase)_dataGrid.SelectedItem;
        }

        private void _dataGrid_MouseRightButtonUp(object sender, MouseButtonEventArgs e)
        {
            try
            {
                //get DataGridRow object
                DependencyObject obj = (DependencyObject)e.OriginalSource;
                while (obj != null && (obj is DataGridRow) == false)
                    obj = VisualTreeHelper.GetParent(obj);

                if (obj == null)
                    return;

                //get connected attribute
                AttributeBase attribute = (AttributeBase)_dataGrid.ItemContainerGenerator.ItemFromContainer(obj as DataGridRow);

                ShowEditWindow(attribute);
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void _dataGrid_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            _dragDropStartPosition = e.GetPosition(null);
        }

        private void _dataGrid_PreviewMouseMove(object sender, MouseEventArgs e)
        {
            try
            {
                Vector difference = _dragDropStartPosition - e.GetPosition(null);

                if (e.LeftButton == MouseButtonState.Released)
                    return;

                if (Math.Abs(difference.X) < SystemParameters.MinimumHorizontalDragDistance && Math.Abs(difference.Y) < SystemParameters.MinimumVerticalDragDistance)
                    return;

                //get DataGridRow object
                DependencyObject obj = (DependencyObject)e.OriginalSource;
                while (obj != null && (obj is DataGridRow) == false)
                    obj = VisualTreeHelper.GetParent(obj);

                if (obj == null)
                    return;

                //get connected attribute
                AttributeBase attribute = (AttributeBase)_dataGrid.ItemContainerGenerator.ItemFromContainer(obj as DataGridRow);

                //Initialize drag & drop object
                DataObject dragData = new DataObject("TemplateAttribute", attribute);
                DragDrop.DoDragDrop(_dataGrid, dragData, DragDropEffects.Move);
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void _dataGrid_DragEnter(object sender, DragEventArgs e)
        {
            if (e.Data.GetDataPresent("TemplateAttribute") == false)
            {
                e.Effects = DragDropEffects.None;
                e.Handled = true;
            }
        }

        private void _dataGrid_DragOver(object sender, DragEventArgs e)
        {
            if (e.Data.GetDataPresent("TemplateAttribute") == false)
            {
                e.Effects = DragDropEffects.None;
                e.Handled = true;
            }
        }

        private void _dataGrid_Drop(object sender, DragEventArgs e)
        {
            if (e.Data.GetDataPresent("TemplateAttribute") == false)
                return;

            try
            {
                //get DataGridRow object
                DependencyObject obj = (DependencyObject)e.OriginalSource;
                while (obj != null && (obj is DataGridRow) == false)
                    obj = VisualTreeHelper.GetParent(obj);

                if (obj == null)
                    return;

                //get connected attribute
                AttributeBase currentAttribute = (AttributeBase)_dataGrid.ItemContainerGenerator.ItemFromContainer(obj as DataGridRow);
                AttributeBase movedAttribute = e.Data.GetData("TemplateAttribute") as AttributeBase;

                //Replace items id
                int tempId = movedAttribute.Id;
                movedAttribute.Id = currentAttribute.Id;
                currentAttribute.Id = tempId;

                //Refresh
                ApplyDataGridSorting();

                //Bring back keyboard focus
                DataGridRow row = (DataGridRow)_dataGrid.ItemContainerGenerator.ContainerFromIndex(_dataGrid.SelectedIndex);
                row.MoveFocus(new TraversalRequest(FocusNavigationDirection.Next));

                ParentProxy.NotifyPropertyChanged("TemplateLastModification");
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void DescriptionTextBlock_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ClickCount <= 1)
                return;

            _descriptionEditTextBox.Visibility = System.Windows.Visibility.Visible;
            _descriptionEditTextBox.Focus();
        }

        private void _descriptionEditTextBox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                _descriptionEditTextBox.Visibility = System.Windows.Visibility.Hidden;
                Keyboard.ClearFocus();
            }
        }

        private void _descriptionEditTextBox_LostFocus(object sender, RoutedEventArgs e)
        {
            _descriptionEditTextBox.Visibility = System.Windows.Visibility.Hidden;
        }

        #endregion

        #region Methods

        /// <summary>
        /// WPF data change notification
        /// </summary>
        /// <param name="property"></param>
        public void NotifyPropertyChanged(String property)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(property));
            }
        }

        /// <summary>
        /// Reassigns IDs for all remaining attributes after a deletion
        /// </summary>
        private void ReassignIds()
        {
            // Access the Items property of the Attributes collection directly
            var attributes = ParentProxy.CurrentTemplate.Attributes.Items;

            // Reassign the IDs sequentially
            for (int i = 0; i < attributes.Count; i++)
            {
                attributes[i].Id = i + 1;
            }

            // Refresh the DataGrid to display updated IDs
            ApplyDataGridSorting();
            _dataGrid.Items.Refresh();
        }


        public void ApplyDataGridSorting()
        {
            // Sort DataGrid by the Id column after reassignment
            _dataGrid.Columns[0].SortDirection = ListSortDirection.Ascending;
            _dataGrid.Items.SortDescriptions.Clear();
            _dataGrid.Items.SortDescriptions.Add(new SortDescription("Id", ListSortDirection.Ascending));
            _dataGrid.UpdateLayout();
        }

        public void MakeDataGridSelection()
        {
            if (_dataGrid.SelectedIndex >= 0)
                return;

            _dataGrid.SelectedIndex = 0;
            CurrentAttribute = (AttributeBase)_dataGrid.SelectedItem;
        }

        private void ShowEditWindow(AttributeBase attribute)
        {
            _dataGrid.SelectedItem = attribute;

            TemplateAttributeWindow window = new TemplateAttributeWindow() { Owner = MainWindow, CurrentAttribute = attribute, ParentProxy = ParentProxy, MainWindow = MainWindow };
            window.ShowDialog();

            ApplyDataGridSorting();
            _dataGrid.SelectedItem = window.CurrentAttribute;

            ParentProxy.NotifyPropertyChanged("TemplateLastModification");
        }

        #endregion
    }
}
