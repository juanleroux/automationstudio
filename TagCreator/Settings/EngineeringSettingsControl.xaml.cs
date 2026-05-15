using gTools.Log;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
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
//using Microsoft.Win32

namespace TagCreator
{
    /// <summary>
    /// Interaction logic for EngineeringSettingsControl.xaml
    /// </summary>
    public partial class EngineeringSettingsControl : UserControl, INotifyPropertyChanged
    {
        #region Initialization

        public event PropertyChangedEventHandler PropertyChanged;

        public EngineeringSettingsControl()
        {
            InitializeComponent();

            this.DataContext = this;
        }

        #endregion

        public MainWindow MainWindow
        {
            get;
            set;
        }

        public Project Project
        {
            get;
            set;
        }        

        public string FolderPath
        {
            get
            {
                return Project.Engineering.FolderPath;
            }
            set
            {
                Project.Engineering.FolderPath = value;
                NotifyPropertyChanged("FolderPath");
            }
        }

		#region Events

		private void UserControl_Unloaded(object sender, RoutedEventArgs e)
        {
            MainWindow.Configuration.Save();
        }
        
        private void SetFolderButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                System.Windows.Forms.FolderBrowserDialog folderDialog = new System.Windows.Forms.FolderBrowserDialog();
                folderDialog.SelectedPath = FolderPath;

                if (folderDialog.ShowDialog() != System.Windows.Forms.DialogResult.OK)
                    return;

                FolderPath = folderDialog.SelectedPath;                
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
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

        #endregion        
    }
}
